-- Medhold hovedstol-konsistens (MEDHOLD_HOVEDSTOL_KONSISTENS_ARBEIDSORDRE).
-- Additiv. Kjør i Supabase SQL Editor etter 0021.
--
-- brev.belop_hovedstol: hovedstolen slik den ble lest/bekreftet PER BREV ved
--   lagring. Fantes tidligere KUN som saker.belop_hovedstol (siste kjente
--   verdi for hele saken, ingen historikk) — uten en per-brev-verdi er det
--   ingenting å sammenligne på tvers av brev i samme sak. Lagt til her som en
--   nødvendig forutsetning for selve konsistenssjekken; arbeidsordrens egen
--   migrasjonsseksjon nevnte kun saker.hovedstol_avvik og antok tydeligvis at
--   per-brev-hovedstolen allerede fantes (den gjorde ikke det — se
--   PROSJEKT_STATUS «Valg tatt underveis»). Samme presisjon som
--   saker.belop_hovedstol (0007).
-- saker.hovedstol_avvik: lagret resultat av finnHovedstolAvvik()
--   (src/lib/hovedstol-konsistens.ts) — hele HovedstolAvvik[]-arrayet
--   (tom array når ingen avvik). Sannhet ved visning; rekalkuleres KUN når
--   et nytt brev legges til på en eksisterende sak (§2), aldri ved ren
--   sidevisning (samme mønster som gebyrsjekk/fristfunn, 0018/0021).
--
-- slett_egen_konto(): ingen endring nødvendig — begge kolonnene ligger på
-- tabeller (brev, saker) som allerede slettes eksplisitt i 0012-versjonen av
-- funksjonen. Verifisert, ikke antatt (samme resonnement som 0018/0021).

alter table public.brev
  add column if not exists belop_hovedstol numeric(12, 2);

alter table public.saker
  add column if not exists hovedstol_avvik jsonb;
