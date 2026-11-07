-- KUN FOR ET TOMT TESTPROSJEKT I SUPABASE. ALDRI I PRODUKSJON.
--
-- Bygger hele Medhold-databasen fra bunnen: 0001–0028 uten 0014
-- (erstattet av 0025). Generert av scripts/lag-testmiljo-sql.mjs fra
-- supabase/migrations. Ikke rediger denne fila; endre migrasjonene og generer på nytt.
--
-- Før du kjører: sjekk at prosjektnavnet øverst i SQL Editor er testprosjektet.
-- Lim inn hele fila og kjør. Feiler noe, er resten ikke kjørt: send feilmeldingen.

-- ============================================================
-- 0001_saker.sql
-- ============================================================

-- Fase 1: Saker (cases) med row-level security.
-- Kjør denne i Supabase SQL Editor (eller via Supabase CLI).

create table if not exists public.saker (
  id uuid primary key default gen_random_uuid(),
  bruker_id uuid not null references auth.users (id) on delete cascade,
  tittel text not null check (char_length(tittel) between 1 and 200),
  beskrivelse text check (char_length(beskrivelse) <= 5000),
  status text not null default 'aktiv'
    check (status in ('aktiv', 'venter_pa_svar', 'fullfort')),
  kategori text not null default 'annet'
    check (kategori in ('helse', 'okonomi', 'familie', 'bolig', 'annet')),
  opprettet timestamptz not null default now(),
  sist_endret timestamptz not null default now()
);

-- Rask oppslag på brukerens egne saker, nyeste først.
create index if not exists saker_bruker_id_sist_endret_idx
  on public.saker (bruker_id, sist_endret desc);

-- Hold sist_endret oppdatert automatisk ved endring.
create or replace function public.set_sist_endret()
returns trigger
language plpgsql
as $$
begin
  new.sist_endret = now();
  return new;
end;
$$;

drop trigger if exists saker_set_sist_endret on public.saker;
create trigger saker_set_sist_endret
  before update on public.saker
  for each row
  execute function public.set_sist_endret();

-- Row-level security: en bruker ser og endrer KUN sine egne rader.
alter table public.saker enable row level security;

drop policy if exists "saker_select_egne" on public.saker;
create policy "saker_select_egne" on public.saker
  for select using (auth.uid() = bruker_id);

drop policy if exists "saker_insert_egne" on public.saker;
create policy "saker_insert_egne" on public.saker
  for insert with check (auth.uid() = bruker_id);

drop policy if exists "saker_update_egne" on public.saker;
create policy "saker_update_egne" on public.saker
  for update using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);

drop policy if exists "saker_delete_egne" on public.saker;
create policy "saker_delete_egne" on public.saker
  for delete using (auth.uid() = bruker_id);

-- ============================================================
-- 0002_frister_neste_steg.sql
-- ============================================================

-- Fase 2: Frister (deadlines) og Neste steg (actions), begge med RLS.
-- Kjør denne i Supabase SQL Editor etter 0001_saker.sql.

-- ============ FRISTER ============
create table if not exists public.frister (
  id uuid primary key default gen_random_uuid(),
  sak_id uuid not null references public.saker (id) on delete cascade,
  bruker_id uuid not null references auth.users (id) on delete cascade,
  tittel text not null check (char_length(tittel) between 1 and 200),
  forfallsdato date not null,
  fullfort boolean not null default false,
  notat text check (char_length(notat) <= 2000),
  opprettet timestamptz not null default now()
);

-- Brukt av «Kommende frister»-oversikten: brukerens uavsluttede frister på dato.
create index if not exists frister_bruker_forfall_idx
  on public.frister (bruker_id, forfallsdato);
create index if not exists frister_sak_idx
  on public.frister (sak_id);

alter table public.frister enable row level security;

drop policy if exists "frister_select_egne" on public.frister;
create policy "frister_select_egne" on public.frister
  for select using (auth.uid() = bruker_id);

drop policy if exists "frister_insert_egne" on public.frister;
create policy "frister_insert_egne" on public.frister
  for insert with check (auth.uid() = bruker_id);

drop policy if exists "frister_update_egne" on public.frister;
create policy "frister_update_egne" on public.frister
  for update using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);

drop policy if exists "frister_delete_egne" on public.frister;
create policy "frister_delete_egne" on public.frister
  for delete using (auth.uid() = bruker_id);

-- ============ NESTE STEG ============
create table if not exists public.neste_steg (
  id uuid primary key default gen_random_uuid(),
  sak_id uuid not null references public.saker (id) on delete cascade,
  bruker_id uuid not null references auth.users (id) on delete cascade,
  tekst text not null check (char_length(tekst) between 1 and 500),
  fullfort boolean not null default false,
  rekkefolge integer not null default 0,
  opprettet timestamptz not null default now()
);

create index if not exists neste_steg_sak_rekkefolge_idx
  on public.neste_steg (sak_id, rekkefolge, opprettet);

alter table public.neste_steg enable row level security;

drop policy if exists "neste_steg_select_egne" on public.neste_steg;
create policy "neste_steg_select_egne" on public.neste_steg
  for select using (auth.uid() = bruker_id);

drop policy if exists "neste_steg_insert_egne" on public.neste_steg;
create policy "neste_steg_insert_egne" on public.neste_steg
  for insert with check (auth.uid() = bruker_id);

drop policy if exists "neste_steg_update_egne" on public.neste_steg;
create policy "neste_steg_update_egne" on public.neste_steg
  for update using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);

drop policy if exists "neste_steg_delete_egne" on public.neste_steg;
create policy "neste_steg_delete_egne" on public.neste_steg
  for delete using (auth.uid() = bruker_id);

-- ============================================================
-- 0003_document_note.sql
-- ============================================================

-- Fase 3: Dokument-notat (AI-forklaring av et innlimt brev), med RLS.
-- Kjør i Supabase SQL Editor etter de tidligere migrasjonene.

create table if not exists public.document_note (
  id uuid primary key default gen_random_uuid(),
  sak_id uuid not null references public.saker (id) on delete cascade,
  bruker_id uuid not null references auth.users (id) on delete cascade,
  original_tekst text not null,
  forklaring text not null,
  foreslatte_steg jsonb not null default '[]'::jsonb,
  foreslatte_frister jsonb not null default '[]'::jsonb,
  opprettet timestamptz not null default now()
);

create index if not exists document_note_sak_idx
  on public.document_note (sak_id, opprettet desc);

alter table public.document_note enable row level security;

drop policy if exists "document_note_select_egne" on public.document_note;
create policy "document_note_select_egne" on public.document_note
  for select using (auth.uid() = bruker_id);

drop policy if exists "document_note_insert_egne" on public.document_note;
create policy "document_note_insert_egne" on public.document_note
  for insert with check (auth.uid() = bruker_id);

drop policy if exists "document_note_delete_egne" on public.document_note;
create policy "document_note_delete_egne" on public.document_note
  for delete using (auth.uid() = bruker_id);

-- ============================================================
-- 0004_slett_konto.sql
-- ============================================================

-- Fase 4 (GDPR): la en innlogget bruker slette HELE sin egen konto og data.
-- Sletting av auth.users kaskaderer til saker, frister, neste_steg og
-- document_note (alle har on delete cascade mot auth.users).
-- Kjør i Supabase SQL Editor.

create or replace function public.slett_egen_konto()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- auth.uid() leser brukeren fra forespørselens JWT. Funksjonen kan derfor
  -- kun slette den som er innlogget — aldri andre.
  delete from auth.users where id = auth.uid();
end;
$$;

-- Kun innloggede brukere kan kalle funksjonen, og kun for seg selv.
revoke all on function public.slett_egen_konto() from public;
grant execute on function public.slett_egen_konto() to authenticated;

-- ============================================================
-- 0005_brev_samtale.sql
-- ============================================================

-- Fase v1.1: Samtale-tråd per brevforklaring (oppfølgingsspørsmål til AI-en).
-- Kjør i Supabase SQL Editor etter de tidligere migrasjonene.

create table if not exists public.brev_samtale (
  id uuid primary key default gen_random_uuid(),
  document_note_id uuid not null
    references public.document_note (id) on delete cascade,
  bruker_id uuid not null references auth.users (id) on delete cascade,
  rolle text not null check (rolle in ('bruker', 'assistent')),
  innhold text not null check (char_length(innhold) <= 20000),
  opprettet timestamptz not null default now()
);

create index if not exists brev_samtale_note_idx
  on public.brev_samtale (document_note_id, opprettet);

alter table public.brev_samtale enable row level security;

drop policy if exists "brev_samtale_select_egne" on public.brev_samtale;
create policy "brev_samtale_select_egne" on public.brev_samtale
  for select using (auth.uid() = bruker_id);

drop policy if exists "brev_samtale_insert_egne" on public.brev_samtale;
create policy "brev_samtale_insert_egne" on public.brev_samtale
  for insert with check (auth.uid() = bruker_id);

drop policy if exists "brev_samtale_delete_egne" on public.brev_samtale;
create policy "brev_samtale_delete_egne" on public.brev_samtale
  for delete using (auth.uid() = bruker_id);

-- ============================================================
-- 0006_varsler.sql
-- ============================================================

-- Fase 5: E-postpåminnelser før frister.
-- Kjør denne i Supabase SQL Editor etter 0005_brev_samtale.sql.
--
-- Logg over sendte påminnelser slik at den daglige cron-jobben ikke sender
-- samme varsel to ganger. Én rad per (frist, terskel) — der terskel er antall
-- dager før forfall varselet gjaldt (7, 3 eller 1). Idempotens sikres av
-- unique-constrainten: et nytt forsøk på samme (frist, terskel) blir en no-op.

create table if not exists public.sendte_varsler (
  id uuid primary key default gen_random_uuid(),
  frist_id uuid not null references public.frister (id) on delete cascade,
  bruker_id uuid not null references auth.users (id) on delete cascade,
  terskel integer not null check (terskel >= 0),
  sendt_at timestamptz not null default now(),
  unique (frist_id, terskel)
);

create index if not exists sendte_varsler_frist_idx
  on public.sendte_varsler (frist_id);

alter table public.sendte_varsler enable row level security;

-- Cron-jobben skriver med service-role-nøkkelen, som går utenom RLS. Policyene
-- her gjelder derfor bare brukerens egen (potensielle) lesing av loggen.
drop policy if exists "sendte_varsler_select_egne" on public.sendte_varsler;
create policy "sendte_varsler_select_egne" on public.sendte_varsler
  for select using (auth.uid() = bruker_id);

-- ============================================================
-- 0007_saker_gjeld.sql
-- ============================================================

-- Medhold Fase 1: utvid saker med gjeld/inkasso-felter (arbeidsordre 4.1).
-- Alle nye kolonner er nullable — eksisterende saker (andre kategorier) er
-- upåvirket. Kjør i Supabase SQL Editor etter 0006_varsler.sql.

alter table public.saker
  add column if not exists kreditor text,
  add column if not exists opprinnelig_kreditor text,
  add column if not exists saksnummer text,
  add column if not exists belop_hovedstol numeric(12, 2),
  add column if not exists belop_totalt numeric(12, 2),
  add column if not exists stadium text
    check (stadium in (
      'faktura', 'purring', 'inkassovarsel', 'betalingsoppfordring',
      'forliksrad', 'namsmann', 'nedbetaling', 'avsluttet'
    ));

-- ============================================================
-- 0008_brev.sql
-- ============================================================

-- Medhold Fase 1: ny «brev»-tabell (arbeidsordre 4.2). Erstatter document_note
-- som datamodell for et analysert brev, men beriket med brevdato/avsender/
-- brevtype/beløp. Data migreres fra document_note med samme id-er, slik at
-- brev_samtale kan repekes til brev uten å miste koblingen (se 0010).
--
-- document_note beholdes inntil de gamle skjermene fjernes i Fase 2; da kan
-- den slippes. Kjør i Supabase SQL Editor etter 0007_saker_gjeld.sql.

create table if not exists public.brev (
  id uuid primary key default gen_random_uuid(),
  sak_id uuid not null references public.saker (id) on delete cascade,
  bruker_id uuid not null references auth.users (id) on delete cascade,
  brevdato date,
  avsender text,
  brevtype text,
  belop numeric(12, 2),
  original_tekst text not null,
  forklaring text not null,
  foreslatte_steg jsonb not null default '[]'::jsonb,
  foreslatte_frister jsonb not null default '[]'::jsonb,
  opprettet timestamptz not null default now()
);

create index if not exists brev_sak_idx
  on public.brev (sak_id, opprettet desc);

alter table public.brev enable row level security;

drop policy if exists "brev_select_egne" on public.brev;
create policy "brev_select_egne" on public.brev
  for select using (auth.uid() = bruker_id);

drop policy if exists "brev_insert_egne" on public.brev;
create policy "brev_insert_egne" on public.brev
  for insert with check (auth.uid() = bruker_id);

drop policy if exists "brev_update_egne" on public.brev;
create policy "brev_update_egne" on public.brev
  for update using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);

drop policy if exists "brev_delete_egne" on public.brev;
create policy "brev_delete_egne" on public.brev
  for delete using (auth.uid() = bruker_id);

-- Datamigrering: kopier eksisterende document_note-rader inn i brev og behold
-- id-ene. Idempotent (on conflict do nothing) slik at migrasjonen kan kjøres
-- på nytt uten å dublere.
insert into public.brev (
  id, sak_id, bruker_id, original_tekst, forklaring,
  foreslatte_steg, foreslatte_frister, opprettet
)
select
  id, sak_id, bruker_id, original_tekst, forklaring,
  foreslatte_steg, foreslatte_frister, opprettet
from public.document_note
on conflict (id) do nothing;

-- ============================================================
-- 0009_frister_kilde.sql
-- ============================================================

-- Medhold Fase 1: utvid frister med kilde og kobling til brev (arbeidsordre 4.3).
-- kilde skiller frister brukeren selv skrev ('manuell'), frister som sto
-- eksplisitt i brevet ('brev_eksplisitt'), og frister koden regnet ut fra en
-- regel ('beregnet' — vises som «beregnet — sjekk brevet» i UI).
-- Kjør i Supabase SQL Editor etter 0008_brev.sql.

alter table public.frister
  add column if not exists kilde text not null default 'manuell'
    check (kilde in ('manuell', 'brev_eksplisitt', 'beregnet')),
  add column if not exists brev_id uuid
    references public.brev (id) on delete set null;

create index if not exists frister_brev_idx
  on public.frister (brev_id);

-- ============================================================
-- 0010_brev_samtale_brev_id.sql
-- ============================================================

-- Medhold Fase 1: repek brev_samtale fra document_note til brev (arbeidsordre
-- 4.2). Additivt og trygt: vi legger til brev_id og fyller den fra
-- document_note_id (samme id-er etter migreringen i 0008). document_note_id
-- beholdes så den gamle sakssiden fortsatt virker til den fjernes i Fase 2 —
-- da gjøres brev_id NOT NULL og document_note_id slippes.
-- Kjør i Supabase SQL Editor etter 0008_brev.sql.

alter table public.brev_samtale
  add column if not exists brev_id uuid
    references public.brev (id) on delete cascade;

update public.brev_samtale
  set brev_id = document_note_id
  where brev_id is null;

create index if not exists brev_samtale_brev_idx
  on public.brev_samtale (brev_id, opprettet);

-- ============================================================
-- 0011_profiler.sql
-- ============================================================

-- Medhold Fase 1: profiler-tabell for tilgangsstyring (arbeidsordre seksjon 6).
-- Én rad per bruker med planen deres. ALL tilgangsstyring i appen går gjennom
-- src/lib/plan.ts (harPluss), aldri direkte mot denne kolonnen. Manglende rad
-- tolkes som plan='gratis'. Kjør i Supabase SQL Editor etter 0010.

create table if not exists public.profiler (
  bruker_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'gratis' check (plan in ('gratis', 'pluss')),
  opprettet timestamptz not null default now(),
  sist_endret timestamptz not null default now()
);

alter table public.profiler enable row level security;

drop policy if exists "profiler_select_egne" on public.profiler;
create policy "profiler_select_egne" on public.profiler
  for select using (auth.uid() = bruker_id);

drop policy if exists "profiler_insert_egne" on public.profiler;
create policy "profiler_insert_egne" on public.profiler
  for insert with check (auth.uid() = bruker_id);

drop policy if exists "profiler_update_egne" on public.profiler;
create policy "profiler_update_egne" on public.profiler
  for update using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);

-- ============================================================
-- 0012_slett_egen_konto_utvidet.sql
-- ============================================================

-- Medhold Fase 1: utvid slett_egen_konto() til å dekke alle tabeller
-- (guardrail). Sletting av auth.users kaskaderer allerede, men vi sletter
-- eksplisitt først slik at funksjonen forblir korrekt selv om en framtidig
-- tabell skulle mangle «on delete cascade». Kjør etter 0011_profiler.sql.

create or replace function public.slett_egen_konto()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- auth.uid() leser brukeren fra forespørselens JWT — funksjonen kan kun
  -- slette den som er innlogget. Barn før foreldre for å unngå FK-feil.
  delete from public.brev_samtale where bruker_id = auth.uid();
  delete from public.sendte_varsler where bruker_id = auth.uid();
  delete from public.frister where bruker_id = auth.uid();
  delete from public.neste_steg where bruker_id = auth.uid();
  delete from public.brev where bruker_id = auth.uid();
  delete from public.document_note where bruker_id = auth.uid();
  delete from public.profiler where bruker_id = auth.uid();
  delete from public.saker where bruker_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.slett_egen_konto() from public;
grant execute on function public.slett_egen_konto() to authenticated;

-- ============================================================
-- 0013_utkast.sql
-- ============================================================

-- Medhold Fase 3: utkast — genererte svarbrev brukeren redigerer og sender selv
-- (arbeidsordre 5.3). Lagres som tidslinjehendelse på kravet. RLS som ellers.
-- Kjør i Supabase SQL Editor etter 0012.

create table if not exists public.utkast (
  id uuid primary key default gen_random_uuid(),
  sak_id uuid not null references public.saker (id) on delete cascade,
  bruker_id uuid not null references auth.users (id) on delete cascade,
  brev_id uuid references public.brev (id) on delete set null,
  type text not null check (type in ('innsigelse', 'betalingsutsettelse', 'klage')),
  innhold text not null,
  opprettet timestamptz not null default now()
);

create index if not exists utkast_sak_idx
  on public.utkast (sak_id, opprettet desc);

alter table public.utkast enable row level security;

drop policy if exists "utkast_select_egne" on public.utkast;
create policy "utkast_select_egne" on public.utkast
  for select using (auth.uid() = bruker_id);

drop policy if exists "utkast_insert_egne" on public.utkast;
create policy "utkast_insert_egne" on public.utkast
  for insert with check (auth.uid() = bruker_id);

drop policy if exists "utkast_update_egne" on public.utkast;
create policy "utkast_update_egne" on public.utkast
  for update using (auth.uid() = bruker_id)
  with check (auth.uid() = bruker_id);

drop policy if exists "utkast_delete_egne" on public.utkast;
create policy "utkast_delete_egne" on public.utkast
  for delete using (auth.uid() = bruker_id);

-- Utvid slett_egen_konto() til også å dekke utkast (guardrail).
create or replace function public.slett_egen_konto()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from public.utkast where bruker_id = auth.uid();
  delete from public.brev_samtale where bruker_id = auth.uid();
  delete from public.sendte_varsler where bruker_id = auth.uid();
  delete from public.frister where bruker_id = auth.uid();
  delete from public.neste_steg where bruker_id = auth.uid();
  delete from public.brev where bruker_id = auth.uid();
  delete from public.document_note where bruker_id = auth.uid();
  delete from public.profiler where bruker_id = auth.uid();
  delete from public.saker where bruker_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.slett_egen_konto() from public;
grant execute on function public.slett_egen_konto() to authenticated;

-- ============================================================
-- 0015_sending.sql
-- ============================================================

-- Medhold «lukke løkka» Fase A: sendingen (MEDHOLD_LOKKE_ARBEIDSORDRE A1).
-- Additiv. Kjør i Supabase SQL Editor etter 0014.
--
-- brev.avsender_epost: kreditors/inkassoselskapets e-postadresse slik den
-- står trykket i brevet (AI trekker den ut KUN når den står eksplisitt;
-- brukeren kan rette/fylle inn i steg 3).
-- utkast.sendt_at: når brukeren selv bekreftet at utkastet ble sendt.
-- Appen sender ALDRI noe til kreditor — sending skjer via brukerens egen
-- e-postklient (mailto:).

alter table public.brev
  add column if not exists avsender_epost text;

alter table public.utkast
  add column if not exists sendt_at timestamptz;

-- slett_egen_konto(): ingen endring nødvendig — begge kolonnene ligger i
-- tabeller (brev, utkast) som allerede slettes eksplisitt i 0014-versjonen
-- av funksjonen. Verifisert, ikke antatt.

-- ============================================================
-- 0016_oppfolging.sql
-- ============================================================

-- Medhold «lukke løkka» Fase B: ventetiden (MEDHOLD_LOKKE_ARBEIDSORDRE B1).
-- Additiv. Kjør i Supabase SQL Editor etter 0015.
--
-- sendte_oppfolginger: logg over oppfølgings-e-poster for saker som har stått i
-- venter_pa_svar en stund. unique(sak_id) gir dedup — maks én oppfølging per
-- sak. Cron-jobben skriver med service-role (går utenom RLS).

create table if not exists public.sendte_oppfolginger (
  id uuid primary key default gen_random_uuid(),
  sak_id uuid not null references public.saker (id) on delete cascade,
  bruker_id uuid not null references auth.users (id) on delete cascade,
  sendt_at timestamptz not null default now(),
  unique (sak_id)
);

create index if not exists sendte_oppfolginger_sak_idx
  on public.sendte_oppfolginger (sak_id);

alter table public.sendte_oppfolginger enable row level security;

drop policy if exists "sendte_oppfolginger_select_egne" on public.sendte_oppfolginger;
create policy "sendte_oppfolginger_select_egne" on public.sendte_oppfolginger
  for select using (auth.uid() = bruker_id);

-- Utvid slett_egen_konto() med den nye tabellen (guardrail).
create or replace function public.slett_egen_konto()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from public.sendte_oppfolginger where bruker_id = auth.uid();
  delete from public.utkast where bruker_id = auth.uid();
  delete from public.brev_samtale where bruker_id = auth.uid();
  delete from public.sendte_varsler where bruker_id = auth.uid();
  delete from public.frister where bruker_id = auth.uid();
  delete from public.neste_steg where bruker_id = auth.uid();
  delete from public.brev where bruker_id = auth.uid();
  delete from public.profiler where bruker_id = auth.uid();
  delete from public.saker where bruker_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.slett_egen_konto() from public;
grant execute on function public.slett_egen_konto() to authenticated;

-- ============================================================
-- 0017_utfall.sql
-- ============================================================

-- Medhold «lukke løkka» Fase C: utfallet (MEDHOLD_LOKKE_ARBEIDSORDRE C1).
-- Additiv. Kjør i Supabase SQL Editor etter 0016.
--
-- saker.utfall: hvordan saken endte. Settes ALDRI automatisk av AI — brukeren
-- bekrefter (eller koden utleder fra brukerens bekreftede valg). Persondata
-- dekkes av eksisterende sak-sletting i slett_egen_konto() (kolonne på saker) —
-- verifisert, ingen funksjonsendring nødvendig.

alter table public.saker
  add column if not exists utfall text
    check (utfall in (
      'medhold', 'delvis_medhold', 'avvist', 'nedbetalingsavtale'
    ));

-- ============================================================
-- 0018_gebyrsjekk.sql
-- ============================================================

-- Medhold gebyrsjekk (MEDHOLD_GEBYRSJEKK_ARBEIDSORDRE §6).
-- Additiv. Kjør i Supabase SQL Editor etter 0017.
--
-- brev.kostnadslinjer: kostnadslinjene AI-en fant i brevet (array av
--   {type, belop, tekst}), KUN det som står eksplisitt. Rådata fra uttrekket.
-- brev.gebyrsjekk: hele GebyrsjekkResultat slik det ble beregnet ved lagring
--   (inkl. satsGyldigFra), lagret som sannhet for visning. Rekalkuleres ALDRI
--   ved lesing — slik at visningen er stabil selv om satstabellen senere endres.
--
-- slett_egen_konto(): ingen endring nødvendig — begge kolonnene ligger på
-- brev, som allerede slettes eksplisitt (delete from public.brev where
-- bruker_id = auth.uid()) i 0012-versjonen av funksjonen. Verifisert, ikke
-- antatt. RLS på brev er urørt (arves; ingen nye tabeller).

alter table public.brev
  add column if not exists kostnadslinjer jsonb;

alter table public.brev
  add column if not exists gebyrsjekk jsonb;

-- ============================================================
-- 0019_plan_b.sql
-- ============================================================

-- Medhold Plan B («Kravet stemmer»-sporet): nytt utfall 'oppgjort' (betalt
-- hele kravet). Additiv/idempotent. Kjør i Supabase SQL Editor etter 0018.
--
-- 0017 la `saker.utfall` som text-kolonne med en inline check-constraint
-- (Postgres auto-navn: saker_utfall_check). Her dropper vi den og legger den
-- til på nytt med 'oppgjort' inkludert. Ingen datatap; eksisterende verdier er
-- fortsatt gyldige.

alter table public.saker drop constraint if exists saker_utfall_check;

alter table public.saker
  add constraint saker_utfall_check
  check (
    utfall in (
      'medhold', 'delvis_medhold', 'avvist', 'nedbetalingsavtale', 'oppgjort'
    )
  );

-- slett_egen_konto(): uendret — utfall er en kolonne på saker, som allerede
-- slettes eksplisitt. Verifisert, ikke antatt.

-- ============================================================
-- 0020_utkast_nedbetalingsavtale.sql
-- ============================================================

-- Medhold Plan B (etterslep): utvid utkast.type-constrainten med
-- 'nedbetalingsavtale'. 0013 la type-kolonnen med en inline check-constraint
-- (auto-navn: utkast_type_check) som kun tillot de tre opprinnelige typene.
-- Uten denne utvidelsen feiler innsetting av nedbetalingsavtale-utkast.
-- Additiv/idempotent. Kjør i Supabase SQL Editor etter 0019.

alter table public.utkast drop constraint if exists utkast_type_check;

alter table public.utkast
  add constraint utkast_type_check
  check (
    type in (
      'innsigelse', 'betalingsutsettelse', 'nedbetalingsavtale', 'klage'
    )
  );

-- ============================================================
-- 0021_frist_og_alvor.sql
-- ============================================================

-- Medhold frist og alvor (MEDHOLD_FRIST_OG_ALVOR_ARBEIDSORDRE §C.1).
-- Additiv. Kjør i Supabase SQL Editor etter 0020.
--
-- brev.fristfunn: lagret FristSammenligning-resultat (sammenlignFrist(),
--   src/lib/frist.ts) — kun satt når brevet har BÅDE en eksplisitt og en
--   beregnet frist å sammenligne. Sannheten for visning (DomMini/rødnote);
--   rekalkuleres ALDRI ved lesing (samme mønster som gebyrsjekk, 0018).
-- brev.alvorlig: erAlvorligSak() (src/lib/alvorsgrense.ts) kjørt på brevets
--   egen tekst ved lagring. Lagret verdi er sannheten ved visning.
--
-- slett_egen_konto(): ingen endring nødvendig — begge kolonnene ligger på
-- brev, som allerede slettes eksplisitt (delete from public.brev where
-- bruker_id = auth.uid()) i 0012-versjonen av funksjonen. Verifisert, ikke
-- antatt (samme resonnement som 0018).

alter table public.brev
  add column if not exists fristfunn jsonb;

alter table public.brev
  add column if not exists alvorlig boolean not null default false;

-- ============================================================
-- 0022_hovedstol_konsistens.sql
-- ============================================================

-- Medhold hovedstol-konsistens (MEDHOLD_HOVEDSTOL_KONSISTENS_ARBEIDSORDRE).
-- Additiv. Kjør i Supabase SQL Editor etter 0021.
--
-- brev.belop_hovedstol: hovedstolen slik den ble lest/bekreftet PER BREV ved
--   lagring. Fantes tidligere KUN som saker.belop_hovedstol (siste kjente
--   verdi for hele saken, ingen historikk) — uten en per-brev-verdi er det
--   ingenting å sammenligne på tvers av brev i samme sak. Lagt til her som en
--   nødvendig forutsetning for selve konsistenssjekken; arbeidsordrens egen
--   migrasjonsseksjon nevnte kun saker.hovedstol_avvik og antok tydeligvis at
--   per-brev-hovedstolen allerede fantes (den gjorde ikke det — se
--   PROSJEKT_STATUS «Valg tatt underveis»). Samme presisjon som
--   saker.belop_hovedstol (0007).
-- saker.hovedstol_avvik: lagret resultat av finnHovedstolAvvik()
--   (src/lib/hovedstol-konsistens.ts) — hele HovedstolAvvik[]-arrayet
--   (tom array når ingen avvik). Sannhet ved visning; rekalkuleres KUN når
--   et nytt brev legges til på en eksisterende sak (§2), aldri ved ren
--   sidevisning (samme mønster som gebyrsjekk/fristfunn, 0018/0021).
--
-- slett_egen_konto(): ingen endring nødvendig — begge kolonnene ligger på
-- tabeller (brev, saker) som allerede slettes eksplisitt i 0012-versjonen av
-- funksjonen. Verifisert, ikke antatt (samme resonnement som 0018/0021).

alter table public.brev
  add column if not exists belop_hovedstol numeric(12, 2);

alter table public.saker
  add column if not exists hovedstol_avvik jsonb;

-- ============================================================
-- 0023_plan_las.sql
-- ============================================================

-- A2: plan-lås. Innloggede brukere kunne opprette og endre sin egen profilrad, og
-- dermed sette plan = 'pluss' selv. Appen leser bare profiler (lib/plan.ts), så
-- brukeren trenger ingen skrivetilgang. Ekte betaling skal skrive med service-rollen.
--
-- Fjerner også anon-tilgangen til slett_egen_konto(): 0016 trakk tilgangen fra
-- public, men Supabase gir anon egen tilgang. Uten innlogging er auth.uid() tom,
-- så kallet slettet ingenting, men funksjonen skal ikke kunne kalles uten innlogging.
--
-- Kjør i Supabase SQL Editor etter 0022. Trygg å kjøre flere ganger.

begin;

drop policy if exists "profiler_insert_egne" on public.profiler;
drop policy if exists "profiler_update_egne" on public.profiler;

-- Dobbelt sikring: en ny policy alene skal ikke kunne åpne skrivetilgangen igjen.
revoke all on table public.profiler from anon;
revoke insert, update, delete, truncate on table public.profiler from authenticated;

revoke all on function public.slett_egen_konto() from public;
revoke all on function public.slett_egen_konto() from anon;
grant execute on function public.slett_egen_konto() to authenticated;

commit;

-- ============================================================
-- 0024_foreldreeierskap.sql
-- ============================================================

-- A3: foreldreeierskap. Policyene sjekket bare at raden hadde brukerens egen
-- bruker_id, ikke hvem som eier saken eller brevet raden kobles til. Fremmednøkler
-- ser ikke RLS, så en bruker kunne legge en rad på en annen brukers sak. Påminnelses-
-- jobben kjører med service-rollen og henter sakstittelen via sak_id, så en slik
-- frist ville gitt angriperen tittelen på e-post.
--
-- Etter dette må saken eller brevet tilhøre brukeren, og et brev koblet til en frist
-- eller et utkast må høre til samme sak.
--
-- Kjør i Supabase SQL Editor etter 0023. Krever Postgres 15 eller nyere. Trygg å
-- kjøre flere ganger. Stopper uten å endre noe hvis eksisterende data bryter reglene.

begin;

do $$
declare
  antall bigint;
begin
  select
      (select count(*) from public.brev x join public.saker s on s.id = x.sak_id where x.bruker_id <> s.bruker_id)
    + (select count(*) from public.frister x join public.saker s on s.id = x.sak_id where x.bruker_id <> s.bruker_id)
    + (select count(*) from public.neste_steg x join public.saker s on s.id = x.sak_id where x.bruker_id <> s.bruker_id)
    + (select count(*) from public.utkast x join public.saker s on s.id = x.sak_id where x.bruker_id <> s.bruker_id)
    + (select count(*) from public.brev_samtale x join public.brev b on b.id = x.brev_id where x.bruker_id <> b.bruker_id)
    + (select count(*) from public.frister x join public.brev b on b.id = x.brev_id where x.sak_id <> b.sak_id)
    + (select count(*) from public.utkast x join public.brev b on b.id = x.brev_id where x.sak_id <> b.sak_id)
  into antall;

  if antall > 0 then
    raise exception 'A3 stoppet: % rader bryter eierskapsreglene. Ingenting er endret.', antall;
  end if;
end;
$$;

-- Brev på frister og utkast må høre til samme sak. Slettes brevet, nullstilles bare
-- brev_id, slik at fristen eller utkastet blir stående på saken.
alter table public.frister drop constraint if exists frister_brev_id_fkey;
alter table public.frister drop constraint if exists frister_brev_sak_fkey;
alter table public.utkast drop constraint if exists utkast_brev_id_fkey;
alter table public.utkast drop constraint if exists utkast_brev_sak_fkey;
alter table public.brev drop constraint if exists brev_id_sak_id_key;

alter table public.brev
  add constraint brev_id_sak_id_key unique (id, sak_id);

alter table public.frister
  add constraint frister_brev_sak_fkey
  foreign key (brev_id, sak_id) references public.brev (id, sak_id)
  on delete set null (brev_id);

alter table public.utkast
  add constraint utkast_brev_sak_fkey
  foreign key (brev_id, sak_id) references public.brev (id, sak_id)
  on delete set null (brev_id);

-- brev
drop policy if exists "brev_insert_egne" on public.brev;
create policy "brev_insert_egne" on public.brev
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

drop policy if exists "brev_update_egne" on public.brev;
create policy "brev_update_egne" on public.brev
  for update using (auth.uid() = bruker_id)
  with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

-- frister
drop policy if exists "frister_insert_egne" on public.frister;
create policy "frister_insert_egne" on public.frister
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

drop policy if exists "frister_update_egne" on public.frister;
create policy "frister_update_egne" on public.frister
  for update using (auth.uid() = bruker_id)
  with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

-- neste_steg
drop policy if exists "neste_steg_insert_egne" on public.neste_steg;
create policy "neste_steg_insert_egne" on public.neste_steg
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

drop policy if exists "neste_steg_update_egne" on public.neste_steg;
create policy "neste_steg_update_egne" on public.neste_steg
  for update using (auth.uid() = bruker_id)
  with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

-- utkast
drop policy if exists "utkast_insert_egne" on public.utkast;
create policy "utkast_insert_egne" on public.utkast
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

drop policy if exists "utkast_update_egne" on public.utkast;
create policy "utkast_update_egne" on public.utkast
  for update using (auth.uid() = bruker_id)
  with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

-- brev_samtale (har ingen update-policy)
drop policy if exists "brev_samtale_insert_egne" on public.brev_samtale;
create policy "brev_samtale_insert_egne" on public.brev_samtale
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.brev b where b.id = brev_id and b.bruker_id = auth.uid())
  );

commit;

-- ============================================================
-- 0025_fjern_document_note.sql
-- ============================================================

-- Rettet utgave av 0014, som aldri ble kjørt i produksjon. Erstatter den fila.
--
-- Feilen: brev_samtale.document_note_id er fortsatt obligatorisk, mens appen bare
-- fyller ut brev_id. All lagring av brevchat feiler derfor, og feilen er usynlig
-- fordi appen ikke sjekker den. Etter dette lagres meldingene.
--
-- Forskjeller fra 0014: overskriver ikke slett_egen_konto() (0014 ville fjernet
-- sendte_oppfolginger fra funksjonen), sletter ingen rader, og stopper hvis det
-- finnes data som ville gått tapt.
--
-- Kjør i Supabase SQL Editor. Uavhengig av 0023 og 0024. Trygg å kjøre flere ganger.

begin;

do $$
declare
  notater bigint := 0;
  uten_brev bigint;
begin
  if to_regclass('public.document_note') is not null then
    execute 'select count(*) from public.document_note' into notater;
  end if;
  select count(*) into uten_brev from public.brev_samtale where brev_id is null;

  if notater > 0 or uten_brev > 0 then
    raise exception 'Stoppet: document_note har % rader og brev_samtale har % rader uten brev_id. Ingenting er endret.',
      notater, uten_brev;
  end if;
end;
$$;

alter table public.brev_samtale drop column if exists document_note_id;
alter table public.brev_samtale alter column brev_id set not null;

drop table if exists public.document_note;

commit;

-- ============================================================
-- 0026_frist_status_og_tilbud.sql
-- ============================================================

-- Pålitelige frister og saksstatus. Additiv: ingen rader slettes eller endres.
--
-- Frister: `fullfort = false` betyr fortsatt «aktiv», så eksisterende spørringer
-- og varselet beholder meningen. Fullført og erstattet skilles med tidspunktene:
--   aktiv      fullfort = false
--   fullført   fullfort = true, erstattet_at er tom
--   erstattet  fullfort = true, erstattet_at er satt
--
-- Utfall: `nedbetalingstilbud` er et tilbud fra kreditor. Saken forblir åpen.
-- `nedbetalingsavtale` er en akseptert avtale, og `oppgjort` er ferdig betalt.
--
-- Kjør i Supabase SQL Editor FØR koden deployes: den nye koden leser kolonnene.
-- Krever 0024. Trygg å kjøre flere ganger.

begin;

alter table public.frister
  add column if not exists fullfort_at timestamptz,
  add column if not exists erstattet_at timestamptz,
  add column if not exists erstattet_av_brev_id uuid
    references public.brev (id) on delete set null;

alter table public.frister drop constraint if exists frister_erstattet_er_lukket;
alter table public.frister
  add constraint frister_erstattet_er_lukket
  check (erstattet_at is null or fullfort);

alter table public.saker drop constraint if exists saker_utfall_check;
alter table public.saker
  add constraint saker_utfall_check
  check (
    utfall in (
      'medhold',
      'delvis_medhold',
      'avvist',
      'nedbetalingstilbud',
      'nedbetalingsavtale',
      'oppgjort'
    )
  );

commit;

-- ============================================================
-- 0027_lagre_brev_atomisk.sql
-- ============================================================

-- Atomisk lagring av et brev: sak, brev, nye frister, erstattede frister og steg
-- lagres i én transaksjon. Feiler ett steg, lagres ingenting.
--
-- Funksjonen kjører med brukerens egne rettigheter (security invoker), så RLS og
-- fremmednøkler gjelder som ved vanlige kall. Den tar imot brukerens VALG
-- (utfall, bekreftet avslutning, gjenåpning) og regner ut statusen selv med
-- brev_statusovergang. Et direkte kall kan derfor ikke avslutte eller åpne en
-- sak uten bekreftelse. Regelen er den samme som statusVedNyttBrev i
-- src/lib/utfall.ts; supabase/tests/statusregel.test.mjs sjekker at de er like.
--
-- Saken låses, og lagringen avvises hvis status eller sist_endret er endret siden
-- saken ble lest, så to lagringer ikke overskriver hverandre.
--
-- Avvik i hovedstol beregnes av appen etterpå. Det er avledet fra brevene og
-- kan beregnes på nytt, og påvirker ikke status eller frister.
--
-- Kjør i Supabase SQL Editor etter 0026, FØR koden deployes. Uavhengig av 0028.
-- Trygg å kjøre flere ganger.

begin;

create or replace function public.brev_statusovergang(
  status_na text,
  valgt_utfall text,
  kommende_frist boolean,
  gjenapne boolean,
  avslutning_bekreftet boolean,
  out status text,
  out stadium text,
  out endre_utfall boolean
)
language plpgsql
immutable
set search_path = public
as $$
begin
  stadium := null;
  endre_utfall := false;
  if valgt_utfall is not null then
    if valgt_utfall not in (
      'medhold', 'delvis_medhold', 'avvist',
      'nedbetalingstilbud', 'nedbetalingsavtale', 'oppgjort'
    ) then
      raise exception 'MEDHOLD_UGYLDIG_UTFALL';
    end if;
    status := case when valgt_utfall in ('medhold', 'oppgjort') then 'fullfort' else 'aktiv' end;
    if status = 'fullfort' and avslutning_bekreftet is not true then
      raise exception 'MEDHOLD_AVSLUTNING_IKKE_BEKREFTET';
    end if;
    if valgt_utfall = 'nedbetalingsavtale' then
      stadium := 'nedbetaling';
    end if;
    endre_utfall := true;
  elsif status_na = 'fullfort' then
    -- En avsluttet sak åpnes bare ved eksplisitt valg. Utfallet beholdes.
    status := case when gjenapne is true then 'aktiv' else 'fullfort' end;
  elsif status_na = 'venter_pa_svar' and kommende_frist is true then
    status := 'aktiv';
  else
    status := status_na;
  end if;
end;
$$;

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
  v_sak uuid;
  v_brev uuid;
  v_status text;
  v_endret timestamptz;
  v_kommende boolean;
  v_overgang record;
  v_erstatt uuid[];
  v_antall integer;
  s jsonb := coalesce(p->'sak', '{}'::jsonb);
begin
  if v_bruker is null then
    raise exception 'MEDHOLD_IKKE_INNLOGGET';
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

    update saker set
      status = v_overgang.status,
      utfall = case when v_overgang.endre_utfall then v_utfall else utfall end,
      stadium = coalesce(
        v_overgang.stadium,
        case when s ? 'stadium' then s->>'stadium' else stadium end
      ),
      belop_totalt = case when s ? 'belop_totalt' then (s->>'belop_totalt')::numeric else belop_totalt end,
      saksnummer = case when s ? 'saksnummer' then s->>'saksnummer' else saksnummer end
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

  return jsonb_build_object('sak_id', v_sak, 'brev_id', v_brev);
end;
$$;

revoke all on function public.brev_statusovergang(text, text, boolean, boolean, boolean) from public;
revoke all on function public.brev_statusovergang(text, text, boolean, boolean, boolean) from anon;
grant execute on function public.brev_statusovergang(text, text, boolean, boolean, boolean) to authenticated;

revoke all on function public.lagre_brev(jsonb) from public;
revoke all on function public.lagre_brev(jsonb) from anon;
grant execute on function public.lagre_brev(jsonb) to authenticated;

commit;

-- ============================================================
-- 0028_fristregler.sql
-- ============================================================

-- Strammere regler for fristene, oppå 0026 slik den er kjørt i produksjon.
-- 0026 er ikke endret etter at den ble kjørt; endringene ligger her i stedet.
--
-- 1. Erstatningsbrevet må høre til samme sak som fristen. 0026 la en enkel
--    fremmednøkkel på erstattet_av_brev_id. Den byttes med en sammensatt
--    (erstattet_av_brev_id, sak_id), slik 0024 gjør for brev_id. Slettes brevet,
--    nullstilles bare koblingen.
-- 2. Fristmodellen håndheves:
--      aktiv      fullfort = false, ingen tidspunkt eller kobling
--      fullført   fullfort = true, erstattet_at er tom
--      erstattet  fullfort = true, erstattet_at er satt
--    Eldre fullførte frister uten tidspunkt er gyldige og tolkes som fullført.
--    Erstatter frister_erstattet_er_lukket fra 0026.
--
-- Endrer ingen rader. Feiler hvis eksisterende data bryter reglene, og ruller da
-- tilbake uten å endre noe. Krever 0024 (brev_id_sak_id_key), 0026 og Postgres 15+.
-- Kjør i Supabase SQL Editor etter 0026, FØR koden deployes. Trygg å kjøre flere
-- ganger.

begin;

alter table public.frister drop constraint if exists frister_erstattet_av_brev_id_fkey;
alter table public.frister drop constraint if exists frister_erstattet_brev_sak_fkey;
alter table public.frister
  add constraint frister_erstattet_brev_sak_fkey
  foreign key (erstattet_av_brev_id, sak_id) references public.brev (id, sak_id)
  on delete set null (erstattet_av_brev_id);

alter table public.frister drop constraint if exists frister_erstattet_er_lukket;
alter table public.frister drop constraint if exists frister_status_konsistent;
alter table public.frister
  add constraint frister_status_konsistent
  check (
    (
      (not fullfort and fullfort_at is null and erstattet_at is null)
      or (fullfort and (fullfort_at is null or erstattet_at is null))
    )
    and (erstattet_av_brev_id is null or erstattet_at is not null)
  );

commit;
