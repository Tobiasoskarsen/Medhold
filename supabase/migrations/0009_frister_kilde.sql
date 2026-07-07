-- Medhold Fase 1: utvid frister med kilde og kobling til brev (arbeidsordre 4.3).
-- kilde skiller frister brukeren selv skrev ('manuell'), frister som sto
-- eksplisitt i brevet ('brev_eksplisitt'), og frister koden regnet ut fra en
-- regel ('beregnet' — vises som «beregnet — sjekk brevet» i UI).
-- Kjør i Supabase SQL Editor etter 0008_brev.sql.

alter table public.frister
  add column if not exists kilde text not null default 'manuell'
    check (kilde in ('manuell', 'brev_eksplisitt', 'beregnet')),
  add column if not exists brev_id uuid
    references public.brev (id) on delete set null;

create index if not exists frister_brev_idx
  on public.frister (brev_id);
