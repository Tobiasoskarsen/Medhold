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
