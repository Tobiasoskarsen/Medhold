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
