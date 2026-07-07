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
