-- Medhold Plan B (etterslep): utvid utkast.type-constrainten med
-- 'nedbetalingsavtale'. 0013 la type-kolonnen med en inline check-constraint
-- (auto-navn: utkast_type_check) som kun tillot de tre opprinnelige typene.
-- Uten denne utvidelsen feiler innsetting av nedbetalingsavtale-utkast.
-- Additiv/idempotent. Kjør i Supabase SQL Editor etter 0019.

alter table public.utkast drop constraint if exists utkast_type_check;

alter table public.utkast
  add constraint utkast_type_check
  check (
    type in (
      'innsigelse', 'betalingsutsettelse', 'nedbetalingsavtale', 'klage'
    )
  );
