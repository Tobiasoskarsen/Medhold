-- Medhold frist og alvor (MEDHOLD_FRIST_OG_ALVOR_ARBEIDSORDRE §C.1).
-- Additiv. Kjør i Supabase SQL Editor etter 0020.
--
-- brev.fristfunn: lagret FristSammenligning-resultat (sammenlignFrist(),
--   src/lib/frist.ts) — kun satt når brevet har BÅDE en eksplisitt og en
--   beregnet frist å sammenligne. Sannheten for visning (DomMini/rødnote);
--   rekalkuleres ALDRI ved lesing (samme mønster som gebyrsjekk, 0018).
-- brev.alvorlig: erAlvorligSak() (src/lib/alvorsgrense.ts) kjørt på brevets
--   egen tekst ved lagring. Lagret verdi er sannheten ved visning.
--
-- slett_egen_konto(): ingen endring nødvendig — begge kolonnene ligger på
-- brev, som allerede slettes eksplisitt (delete from public.brev where
-- bruker_id = auth.uid()) i 0012-versjonen av funksjonen. Verifisert, ikke
-- antatt (samme resonnement som 0018).

alter table public.brev
  add column if not exists fristfunn jsonb;

alter table public.brev
  add column if not exists alvorlig boolean not null default false;
