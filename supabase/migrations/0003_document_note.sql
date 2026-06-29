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
