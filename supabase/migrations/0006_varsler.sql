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
