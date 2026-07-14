-- Medhold «lukke løkka» Fase C: utfallet (MEDHOLD_LOKKE_ARBEIDSORDRE C1).
-- Additiv. Kjør i Supabase SQL Editor etter 0016.
--
-- saker.utfall: hvordan saken endte. Settes ALDRI automatisk av AI — brukeren
-- bekrefter (eller koden utleder fra brukerens bekreftede valg). Persondata
-- dekkes av eksisterende sak-sletting i slett_egen_konto() (kolonne på saker) —
-- verifisert, ingen funksjonsendring nødvendig.

alter table public.saker
  add column if not exists utfall text
    check (utfall in (
      'medhold', 'delvis_medhold', 'avvist', 'nedbetalingsavtale'
    ));
