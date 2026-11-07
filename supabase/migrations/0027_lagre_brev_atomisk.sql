-- Atomisk lagring av et brev: sak, brev, nye frister, erstattede frister og steg
-- lagres i én transaksjon. Feiler ett steg, lagres ingenting.
--
-- Funksjonen kjører med brukerens egne rettigheter (security invoker), så RLS og
-- fremmednøkler gjelder som ved vanlige kall. Statusregelen bor i appen
-- (lib/utfall.ts); her låses saken, og lagringen avvises hvis saken er endret
-- siden den ble lest (forventet status og sist_endret), så to faner ikke
-- overskriver hverandres beslutninger.
--
-- Avvik i hovedstol beregnes av appen etterpå. Det er avledet fra brevene og
-- kan beregnes på nytt, og påvirker ikke status eller frister.
--
-- Kjør i Supabase SQL Editor etter 0026, FØR koden deployes.
-- Trygg å kjøre flere ganger.

begin;

create or replace function public.lagre_brev(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bruker uuid := auth.uid();
  v_modus text := p->>'modus';
  v_sak uuid;
  v_brev uuid;
  v_status text;
  v_endret timestamptz;
  v_erstatt uuid[];
  v_antall integer;
  s jsonb := coalesce(p->'sak', '{}'::jsonb);
begin
  if v_bruker is null then
    raise exception 'MEDHOLD_IKKE_INNLOGGET';
  end if;

  if v_modus = 'eksisterende' then
    v_sak := (p->>'sak_id')::uuid;
    select status, sist_endret into v_status, v_endret
      from saker
      where id = v_sak and bruker_id = v_bruker
      for update;
    if not found then
      raise exception 'MEDHOLD_FANT_IKKE_SAK';
    end if;
    if p->>'forventet_status' is distinct from v_status
       or (p->>'forventet_sist_endret')::timestamptz is distinct from v_endret then
      raise exception 'MEDHOLD_SAK_ENDRET';
    end if;

    update saker set
      status = case when s ? 'status' then s->>'status' else status end,
      utfall = case when s ? 'utfall' then s->>'utfall' else utfall end,
      stadium = case when s ? 'stadium' then s->>'stadium' else stadium end,
      belop_totalt = case when s ? 'belop_totalt' then (s->>'belop_totalt')::numeric else belop_totalt end,
      saksnummer = case when s ? 'saksnummer' then s->>'saksnummer' else saksnummer end
    where id = v_sak and bruker_id = v_bruker;
  elsif v_modus = 'ny' then
    insert into saker (bruker_id, tittel, kreditor, saksnummer, belop_totalt, stadium, status, kategori)
    values (
      v_bruker,
      s->>'tittel',
      s->>'kreditor',
      s->>'saksnummer',
      (s->>'belop_totalt')::numeric,
      s->>'stadium',
      'aktiv',
      'okonomi'
    )
    returning id into v_sak;
  else
    raise exception 'MEDHOLD_UGYLDIG';
  end if;

  insert into brev (
    sak_id, bruker_id, brevdato, avsender, avsender_epost, brevtype, belop,
    original_tekst, forklaring, foreslatte_steg, foreslatte_frister,
    kostnadslinjer, gebyrsjekk, fristfunn, alvorlig, belop_hovedstol
  )
  select
    v_sak, v_bruker, r.brevdato, r.avsender, r.avsender_epost, r.brevtype, r.belop,
    r.original_tekst, r.forklaring, coalesce(r.foreslatte_steg, '[]'::jsonb),
    coalesce(r.foreslatte_frister, '[]'::jsonb), r.kostnadslinjer, r.gebyrsjekk,
    r.fristfunn, coalesce(r.alvorlig, false), r.belop_hovedstol
  from jsonb_populate_record(null::brev, p->'brev') r
  returning id into v_brev;

  insert into frister (sak_id, bruker_id, tittel, forfallsdato, brev_id, kilde)
  select v_sak, v_bruker, r.tittel, r.forfallsdato, v_brev, coalesce(r.kilde, 'manuell')
  from jsonb_populate_recordset(null::frister, coalesce(p->'frister', '[]'::jsonb)) r;

  select coalesce(array_agg(distinct x::uuid), '{}'::uuid[]) into v_erstatt
  from jsonb_array_elements_text(coalesce(p->'erstatter', '[]'::jsonb)) x;
  if cardinality(v_erstatt) > 0 then
    if v_modus <> 'eksisterende' then
      raise exception 'MEDHOLD_FRIST_ERSTATTET';
    end if;
    update frister set
      fullfort = true,
      fullfort_at = null,
      erstattet_at = now(),
      erstattet_av_brev_id = v_brev
    where sak_id = v_sak and bruker_id = v_bruker and not fullfort and id = any(v_erstatt);
    get diagnostics v_antall = row_count;
    -- Alle valgte frister må finnes, være aktive og høre til saken.
    if v_antall <> cardinality(v_erstatt) then
      raise exception 'MEDHOLD_FRIST_ERSTATTET';
    end if;
  end if;

  insert into neste_steg (sak_id, bruker_id, tekst, rekkefolge)
  select v_sak, v_bruker, t.tekst, (t.nr - 1)::integer
  from jsonb_array_elements_text(coalesce(p->'steg', '[]'::jsonb)) with ordinality as t(tekst, nr);

  return jsonb_build_object('sak_id', v_sak, 'brev_id', v_brev);
end;
$$;

revoke all on function public.lagre_brev(jsonb) from public;
revoke all on function public.lagre_brev(jsonb) from anon;
grant execute on function public.lagre_brev(jsonb) to authenticated;

commit;
