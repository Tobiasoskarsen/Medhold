-- Tilbakeføring av migrasjon 0032. Kjøres BARE hvis 0032 må fjernes.
--
-- Setter lagre_brev tilbake til versjonen i 0029: en sak som venter på svar,
-- blir igjen aktiv av ethvert brev med en kommende frist. Ingen tabeller,
-- kolonner eller rader endres, så ingen data går tapt.
--
-- Rekkefølge: koden kan stå. Forhåndsvisningen i appen viser da den nye
-- regelen mens databasen lagrer den gamle, så rull helst tilbake koden også.

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
  v_utfall text := nullif(p->>'utfall', '');
  v_nokkel uuid;
  v_tidligere jsonb;
  v_resultat jsonb;
  v_sak uuid;
  v_brev uuid;
  v_status text;
  v_endret timestamptz;
  v_kommende boolean;
  v_overgang record;
  v_erstatt uuid[];
  v_antall integer;
  v_ny_dato date;
  v_siste date;
  v_vurdering text := 'ny';
  v_bruk boolean := true;
  s jsonb := coalesce(p->'sak', '{}'::jsonb);
begin
  if v_bruker is null then
    raise exception 'MEDHOLD_IKKE_INNLOGGET';
  end if;

  begin
    v_nokkel := nullif(p->>'nokkel', '')::uuid;
    v_ny_dato := nullif(p->'brev'->>'brevdato', '')::date;
  exception when others then
    raise exception 'MEDHOLD_UGYLDIG';
  end;
  -- Tom streng betyr ukjent dato. Den lagres som null, aldri som dagens dato.
  if p ? 'brev' then
    p := jsonb_set(p, '{brev,brevdato}', coalesce(to_jsonb(v_ny_dato), 'null'::jsonb));
  end if;

  -- A3: samme nøkkel gir samme resultat. Låsen gjør at et samtidig kall med
  -- samme nøkkel venter til dette er ferdig, og så finner kvitteringen.
  if v_nokkel is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('lagre_brev:' || v_bruker::text || ':' || v_nokkel::text, 0)
    );
    select resultat into v_tidligere
      from lagringsforsok
      where bruker_id = v_bruker and nokkel = v_nokkel;
    if found then
      return v_tidligere || jsonb_build_object('gjentatt', true);
    end if;
  end if;

  if v_modus = 'eksisterende' then
    v_sak := (p->>'sak_id')::uuid;
    select saker.status, saker.sist_endret into v_status, v_endret
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

    v_kommende := exists (
      select 1
      from jsonb_populate_recordset(null::frister, coalesce(p->'frister', '[]'::jsonb)) r
      where r.forfallsdato >= (now() at time zone 'Europe/Oslo')::date
    );
    select * into v_overgang from brev_statusovergang(
      v_status,
      v_utfall,
      v_kommende,
      coalesce((p->>'gjenapne')::boolean, false),
      coalesce((p->>'avslutning_bekreftet')::boolean, false)
    );

    -- A2: bare et nyere brev endrer sakens tall. Ellers fylles bare tomme felt,
    -- med mindre brukeren har valgt å bruke tallene likevel.
    select max(brevdato) into v_siste
      from brev
      where sak_id = v_sak and bruker_id = v_bruker;
    v_vurdering := brev_datovurdering(v_ny_dato, v_siste);
    v_bruk := v_vurdering = 'nyest' or coalesce((p->>'oppdater_sak')::boolean, false);

    update saker set
      status = v_overgang.status,
      utfall = case when v_overgang.endre_utfall then v_utfall else utfall end,
      stadium = coalesce(
        v_overgang.stadium,
        case when s ? 'stadium' and (v_bruk or stadium is null) then s->>'stadium' else stadium end
      ),
      belop_totalt = case
        when s ? 'belop_totalt' and (v_bruk or belop_totalt is null) then (s->>'belop_totalt')::numeric
        else belop_totalt
      end,
      saksnummer = case
        when s ? 'saksnummer' and (v_bruk or saksnummer is null) then s->>'saksnummer'
        else saksnummer
      end
    where id = v_sak and bruker_id = v_bruker;
  elsif v_modus = 'ny' then
    -- En ny sak starter alltid som aktiv, uten utfall.
    if v_utfall is not null then
      raise exception 'MEDHOLD_UGYLDIG_UTFALL';
    end if;
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

  v_resultat := jsonb_build_object(
    'sak_id', v_sak,
    'brev_id', v_brev,
    'datovurdering', v_vurdering,
    'sak_oppdatert', v_bruk
  );

  -- Kvitteringen lagres i samme transaksjon. Primærnøkkelen stopper et
  -- eventuelt dobbeltkall selv om låsen skulle bli omgått.
  if v_nokkel is not null then
    insert into lagringsforsok (bruker_id, nokkel, sak_id, resultat)
    values (v_bruker, v_nokkel, v_sak, v_resultat);
  end if;

  return v_resultat || jsonb_build_object('gjentatt', false);
end;
$$;

revoke all on function public.lagre_brev(jsonb) from public;
revoke all on function public.lagre_brev(jsonb) from anon;
grant execute on function public.lagre_brev(jsonb) to authenticated;

commit;
