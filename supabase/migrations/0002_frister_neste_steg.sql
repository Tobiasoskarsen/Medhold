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
