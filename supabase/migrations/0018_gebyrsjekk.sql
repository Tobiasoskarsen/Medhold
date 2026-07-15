-- Medhold gebyrsjekk (MEDHOLD_GEBYRSJEKK_ARBEIDSORDRE §6).
-- Additiv. Kjør i Supabase SQL Editor etter 0017.
--
-- brev.kostnadslinjer: kostnadslinjene AI-en fant i brevet (array av
--   {type, belop, tekst}), KUN det som står eksplisitt. Rådata fra uttrekket.
-- brev.gebyrsjekk: hele GebyrsjekkResultat slik det ble beregnet ved lagring
--   (inkl. satsGyldigFra), lagret som sannhet for visning. Rekalkuleres ALDRI
--   ved lesing — slik at visningen er stabil selv om satstabellen senere endres.
--
-- slett_egen_konto(): ingen endring nødvendig — begge kolonnene ligger på
-- brev, som allerede slettes eksplisitt (delete from public.brev where
-- bruker_id = auth.uid()) i 0012-versjonen av funksjonen. Verifisert, ikke
-- antatt. RLS på brev er urørt (arves; ingen nye tabeller).

alter table public.brev
  add column if not exists kostnadslinjer jsonb;

alter table public.brev
  add column if not exists gebyrsjekk jsonb;
