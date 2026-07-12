-- Medhold «lukke løkka» Fase A: sendingen (MEDHOLD_LOKKE_ARBEIDSORDRE A1).
-- Additiv. Kjør i Supabase SQL Editor etter 0014.
--
-- brev.avsender_epost: kreditors/inkassoselskapets e-postadresse slik den
-- står trykket i brevet (AI trekker den ut KUN når den står eksplisitt;
-- brukeren kan rette/fylle inn i steg 3).
-- utkast.sendt_at: når brukeren selv bekreftet at utkastet ble sendt.
-- Appen sender ALDRI noe til kreditor — sending skjer via brukerens egen
-- e-postklient (mailto:).

alter table public.brev
  add column if not exists avsender_epost text;

alter table public.utkast
  add column if not exists sendt_at timestamptz;

-- slett_egen_konto(): ingen endring nødvendig — begge kolonnene ligger i
-- tabeller (brev, utkast) som allerede slettes eksplisitt i 0014-versjonen
-- av funksjonen. Verifisert, ikke antatt.
