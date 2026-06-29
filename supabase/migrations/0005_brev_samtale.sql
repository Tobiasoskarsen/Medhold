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
