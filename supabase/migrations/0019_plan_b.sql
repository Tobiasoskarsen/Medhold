-- Medhold Plan B («Kravet stemmer»-sporet): nytt utfall 'oppgjort' (betalt
-- hele kravet). Additiv/idempotent. Kjør i Supabase SQL Editor etter 0018.
--
-- 0017 la `saker.utfall` som text-kolonne med en inline check-constraint
-- (Postgres auto-navn: saker_utfall_check). Her dropper vi den og legger den
-- til på nytt med 'oppgjort' inkludert. Ingen datatap; eksisterende verdier er
-- fortsatt gyldige.

alter table public.saker drop constraint if exists saker_utfall_check;

alter table public.saker
  add constraint saker_utfall_check
  check (
    utfall in (
      'medhold', 'delvis_medhold', 'avvist', 'nedbetalingsavtale', 'oppgjort'
    )
  );

-- slett_egen_konto(): uendret — utfall er en kolonne på saker, som allerede
-- slettes eksplisitt. Verifisert, ikke antatt.
