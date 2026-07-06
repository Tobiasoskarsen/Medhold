-- Medhold: kjør de nye migrasjonene (Fase 1–3) i én omgang.
-- Forutsetter at 0001–0006 (Klarvei) allerede er kjørt.
-- Alt her er additivt og idempotent — trygt å kjøre (på nytt).
-- Den destruktive oppryddingen 0014 (dropp document_note) er UTELATT
-- her med vilje; kjør den separat senere når du er klar.


-- ======================================================================
-- 0007_saker_gjeld.sql
-- ======================================================================
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

-- ======================================================================
-- 0008_brev.sql
-- ======================================================================
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

-- ======================================================================
-- 0009_frister_kilde.sql
-- ======================================================================
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

-- ======================================================================
-- 0010_brev_samtale_brev_id.sql
-- ======================================================================
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

-- ======================================================================
-- 0011_profiler.sql
-- ======================================================================
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

-- ======================================================================
-- 0012_slett_egen_konto_utvidet.sql
-- ======================================================================
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

-- ======================================================================
-- 0013_utkast.sql
-- ======================================================================
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
