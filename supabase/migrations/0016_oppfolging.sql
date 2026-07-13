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
