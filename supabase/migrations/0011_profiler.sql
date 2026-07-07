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
