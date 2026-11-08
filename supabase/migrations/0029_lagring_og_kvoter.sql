-- Pakke A: dato-bevisst og idempotent lagring av brev (A2, A3).
-- Se supabase/dokumentasjon/0029_lagring_og_kvoter.md for full beskrivelse,
-- deployrekkefølge og tilbakeføring.
--
-- A2  Et brev oppdaterer sakens beløp, stadium og saksnummer bare når det er
--     nyere enn alle daterte brev saken allerede har. Er brevet eldre, like
--     gammelt eller uten dato, gjettes det ikke: bare tomme felt fylles, med
--     mindre brukeren eksplisitt har valgt «bruk likevel» (oppdater_sak).
--     Brevet lagres alltid som historikk. Udaterte brev i saken teller ikke i
--     sammenligningen: med denne regelen endrer de aldri saken selv. Regelen er den samme
--     som vurderBrevdato i src/lib/brevdato.ts; en test sjekker at de er like.
--
-- A3  Hvert lagringsforsøk har en nøkkel fra klienten. Samme nøkkel gir samme
--     resultat uten å lagre noe på nytt. Nøkkelen låses med en advisory-lås i
--     transaksjonen og registreres i lagringsforsok med primærnøkkel
--     (bruker_id, nokkel), så to samtidige kall ikke kan lage to brev.
--
-- A4  Kvoter for AI-bruk og innlogging. Grensene står i tabellen kvoter og kan
--     endres med én UPDATE, uten kodeendring. Bruken registreres i kvotebruk
--     med tall og koder, aldri tekst. Funksjonene kan bare kalles av
--     service_role (serveren): en bruker kan ikke frigi sin egen kvote.
--
-- Krever 0027 (lagre_brev, brev_statusovergang). Endrer ingen eksisterende rader.
-- Kjør i Supabase SQL Editor FØR koden deployes. Trygg å kjøre flere ganger.

begin;

-- lagre_brev under kaller brev_statusovergang. Plpgsql sjekker ikke det når
-- funksjonen lages, så uten denne sperren ville feilen først vist seg ved
-- første lagring.
do $$
begin
  if to_regprocedure('public.brev_statusovergang(text, text, boolean, boolean, boolean)') is null then
    raise exception 'MEDHOLD_0029: kjør 0027 før 0029';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A3: lagringsforsøk
-- ---------------------------------------------------------------------------

create table if not exists public.lagringsforsok (
  bruker_id uuid not null references auth.users (id) on delete cascade,
  nokkel uuid not null,
  sak_id uuid not null references public.saker (id) on delete cascade,
  resultat jsonb not null,
  opprettet timestamptz not null default now(),
  primary key (bruker_id, nokkel)
);

create index if not exists lagringsforsok_sak_id_idx on public.lagringsforsok (sak_id);

alter table public.lagringsforsok enable row level security;

drop policy if exists "lagringsforsok_select_egne" on public.lagringsforsok;
create policy "lagringsforsok_select_egne" on public.lagringsforsok
  for select to authenticated using (bruker_id = auth.uid());

drop policy if exists "lagringsforsok_insert_egne" on public.lagringsforsok;
create policy "lagringsforsok_insert_egne" on public.lagringsforsok
  for insert to authenticated with check (bruker_id = auth.uid());

-- Raden er en kvittering: den endres eller slettes aldri av brukeren.
revoke all on table public.lagringsforsok from anon;
revoke update, delete, truncate on table public.lagringsforsok from authenticated;

-- ---------------------------------------------------------------------------
-- A2: datoregelen
-- ---------------------------------------------------------------------------

-- nyest    brevet er nyere enn alle daterte brev i saken (eller saken har ingen)
-- eldre    brevet er eldre enn sakens nyeste daterte brev
-- lik      samme dato som sakens nyeste daterte brev
-- mangler  brevet har ingen dato
create or replace function public.brev_datovurdering(
  ny_dato date,
  siste_dato date
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when ny_dato is null then 'mangler'
    when siste_dato is null then 'nyest'
    when ny_dato > siste_dato then 'nyest'
    when ny_dato = siste_dato then 'lik'
    else 'eldre'
  end;
$$;

revoke all on function public.brev_datovurdering(date, date) from public;
revoke all on function public.brev_datovurdering(date, date) from anon;
grant execute on function public.brev_datovurdering(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- lagre_brev med A2 og A3. Ellers som i 0027.
-- ---------------------------------------------------------------------------

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


-- ---------------------------------------------------------------------------
-- A4: kvoter
-- ---------------------------------------------------------------------------

-- Grensene. Én rad per handling. Justeres sentralt:
--   update public.kvoter set grense = 10 where handling = 'dokumentanalyse';
-- Testmiljøet får egne verdier fra supabase/testmiljo/testkvoter.sql.
create table if not exists public.kvoter (
  handling text primary key,
  grense integer not null check (grense >= 0),
  vindu_sekunder integer not null check (vindu_sekunder > 0),
  beskrivelse text not null,
  oppdatert timestamptz not null default now()
);

-- Startkvoter for gratis beta. «do nothing» gjør at justerte verdier står seg
-- om migrasjonen kjøres på nytt.
insert into public.kvoter (handling, grense, vindu_sekunder, beskrivelse) values
  ('dokumentanalyse', 5, 86400, 'Dokumentanalyser per bruker per rullerende døgn'),
  ('chat', 20, 86400, 'AI-chatmeldinger per bruker per rullerende døgn'),
  ('utkast', 3, 86400, 'Nye AI-genererte utkast per bruker per rullerende døgn'),
  ('innlogging_epost', 5, 3600, 'Forespørsler om innloggingskode per e-postadresse per time'),
  ('innlogging_ip', 30, 3600, 'Forespørsler om innloggingskode per IP-adresse per time (romslig for delte nettverk)')
on conflict (handling) do nothing;

-- Hver reservasjon. nokkel er bruker-id, eller en HMAC av e-post eller IP.
-- Klartekst e-post eller IP lagres aldri. Ingen tekst fra brev eller AI.
create table if not exists public.kvotebruk (
  id bigint generated always as identity primary key,
  gruppe uuid not null,
  handling text not null references public.kvoter (handling),
  nokkel text not null check (char_length(nokkel) between 1 and 128),
  bruker_id uuid references auth.users (id) on delete cascade,
  forsok uuid,
  status text not null default 'reservert' check (status in ('reservert', 'brukt', 'frigitt')),
  gjentak integer not null default 0,
  opprettet timestamptz not null default now(),
  avsluttet timestamptz,
  -- Kostnadsmålinger. Bare tall og korte koder.
  modell text check (modell is null or modell ~ '^[a-z0-9._:-]{1,64}$'),
  inn_tokens integer check (inn_tokens is null or inn_tokens >= 0),
  ut_tokens integer check (ut_tokens is null or ut_tokens >= 0),
  ai_kall integer check (ai_kall is null or ai_kall >= 0),
  varighet_ms integer check (varighet_ms is null or varighet_ms >= 0),
  feil text check (feil is null or feil ~ '^[a-z0-9_]{1,32}$')
);

create index if not exists kvotebruk_telling_idx on public.kvotebruk (handling, nokkel, opprettet desc);
create index if not exists kvotebruk_gruppe_idx on public.kvotebruk (gruppe);
create index if not exists kvotebruk_bruker_idx on public.kvotebruk (bruker_id);
-- Oppslag på gjentatte forsøk. Ikke unik: samme innhold kan analyseres igjen
-- senere. Låsen i reserver_kvote hindrer to samtidige reservasjoner.
create index if not exists kvotebruk_forsok_idx
  on public.kvotebruk (handling, nokkel, forsok)
  where forsok is not null;

-- Ingen policyer: tabellene nås bare av service_role, som går utenom RLS.
alter table public.kvoter enable row level security;
alter table public.kvotebruk enable row level security;
revoke all on table public.kvoter from anon, authenticated;
revoke all on table public.kvotebruk from anon, authenticated;

-- Reserverer kvote for én eller flere grenser i samme transaksjon, f.eks.
-- både e-post og IP ved innlogging. p_krav: [{handling, nokkel, bruker_id?}].
-- En reservasjon teller med en gang, så samtidige kall ikke kan gå over
-- grensen. Blir den ikke fullført innen p_reservert_sekunder (serveren krasjet),
-- slutter den å telle.
--
-- Svar: {ok:true, gruppe, igjen, gjentatt} eller
--       {ok:false, grunn: kvote|pagar|gjentatt, handling, grense, nullstilles}
create or replace function public.reserver_kvote(
  p_krav jsonb,
  p_forsok uuid default null,
  p_reservert_sekunder integer default 900
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  r record;
  v_gruppe uuid := gen_random_uuid();
  v_kvote record;
  v_brukt integer;
  v_eldste timestamptz;
  v_igjen integer;
  v_forste_h text;
  v_forste_n text;
  v_tidligere record;
begin
  if jsonb_typeof(p_krav) is distinct from 'array' or jsonb_array_length(p_krav) = 0 then
    raise exception 'MEDHOLD_UGYLDIG';
  end if;
  v_forste_h := p_krav->0->>'handling';
  v_forste_n := p_krav->0->>'nokkel';

  -- Lås hver grense i fast rekkefølge, så to kall ikke låser hverandre fast.
  for r in
    select distinct e->>'handling' as h, e->>'nokkel' as n
    from jsonb_array_elements(p_krav) e
    order by 1, 2
  loop
    if r.h is null or coalesce(r.n, '') = '' then
      raise exception 'MEDHOLD_UGYLDIG';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('kvote:' || r.h || ':' || r.n, 0));
  end loop;

  -- Samme forsøk igjen innen en time: aldri ny belastning. Pågår det, avvises
  -- det nye kallet. Er det fullført, tillates ett nytt forsøk gratis (f.eks.
  -- etter at svaret gikk tapt på nettet). Flere enn det må startes som et nytt
  -- forsøk. En reservasjon som har utløpt, teller ikke.
  if p_forsok is not null then
    select gruppe, status, gjentak into v_tidligere
      from kvotebruk
      where handling = v_forste_h and nokkel = v_forste_n and forsok = p_forsok
        and opprettet > now() - interval '1 hour'
        and (
          status = 'brukt'
          or (status = 'reservert' and opprettet > now() - make_interval(secs => p_reservert_sekunder))
        )
      order by opprettet desc
      limit 1;
    if found then
      if v_tidligere.status = 'reservert' then
        return jsonb_build_object('ok', false, 'grunn', 'pagar', 'handling', v_forste_h);
      elsif v_tidligere.gjentak < 1 then
        update kvotebruk set gjentak = gjentak + 1 where gruppe = v_tidligere.gruppe;
        return jsonb_build_object('ok', true, 'gruppe', v_tidligere.gruppe, 'gjentatt', true, 'igjen', null);
      else
        return jsonb_build_object('ok', false, 'grunn', 'gjentatt', 'handling', v_forste_h);
      end if;
    end if;
  end if;

  for r in
    select distinct e->>'handling' as h, e->>'nokkel' as n
    from jsonb_array_elements(p_krav) e
  loop
    select grense, vindu_sekunder into v_kvote from kvoter where handling = r.h;
    if not found then
      raise exception 'MEDHOLD_UKJENT_KVOTE';
    end if;
    select count(*)::integer, min(opprettet) into v_brukt, v_eldste
      from kvotebruk
      where handling = r.h and nokkel = r.n
        and opprettet > now() - make_interval(secs => v_kvote.vindu_sekunder)
        and (
          status = 'brukt'
          or (status = 'reservert' and opprettet > now() - make_interval(secs => p_reservert_sekunder))
        );
    if v_brukt >= v_kvote.grense then
      return jsonb_build_object(
        'ok', false,
        'grunn', 'kvote',
        'handling', r.h,
        'grense', v_kvote.grense,
        'nullstilles', v_eldste + make_interval(secs => v_kvote.vindu_sekunder)
      );
    end if;
    if r.h = v_forste_h and r.n = v_forste_n then
      v_igjen := v_kvote.grense - v_brukt - 1;
    end if;
  end loop;

  insert into kvotebruk (gruppe, handling, nokkel, bruker_id, forsok)
  select distinct on (e->>'handling', e->>'nokkel')
    v_gruppe, e->>'handling', e->>'nokkel', nullif(e->>'bruker_id', '')::uuid, p_forsok
  from jsonb_array_elements(p_krav) e;

  return jsonb_build_object('ok', true, 'gruppe', v_gruppe, 'gjentatt', false, 'igjen', v_igjen);
end;
$$;

-- Avslutter en reservasjon: brukt (teller) eller frigitt (teller ikke, f.eks.
-- ved tidsavbrudd hos AI-tjenesten). Bare reservasjoner som fortsatt står som
-- reservert endres, så et allerede fullført forsøk ikke kan frigis i ettertid.
create or replace function public.fullfor_kvote(
  p_gruppe uuid,
  p_brukt boolean,
  p_maling jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_antall integer;
begin
  update kvotebruk set
    status = case when p_brukt then 'brukt' else 'frigitt' end,
    avsluttet = now(),
    modell = nullif(p_maling->>'modell', ''),
    inn_tokens = (p_maling->>'inn_tokens')::integer,
    ut_tokens = (p_maling->>'ut_tokens')::integer,
    ai_kall = (p_maling->>'ai_kall')::integer,
    varighet_ms = (p_maling->>'varighet_ms')::integer,
    feil = nullif(p_maling->>'feil', '')
  where gruppe = p_gruppe and status = 'reservert';
  get diagnostics v_antall = row_count;
  return v_antall > 0;
end;
$$;

revoke all on function public.reserver_kvote(jsonb, uuid, integer) from public, anon, authenticated;
revoke all on function public.fullfor_kvote(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.reserver_kvote(jsonb, uuid, integer) to service_role;
grant execute on function public.fullfor_kvote(uuid, boolean, jsonb) to service_role;
grant select, insert, update on table public.kvotebruk to service_role;
grant select on table public.kvoter to service_role;

commit;
