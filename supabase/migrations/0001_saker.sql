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
