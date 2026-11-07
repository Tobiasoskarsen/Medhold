-- Pålitelige frister og saksstatus. Additiv: ingen rader slettes eller endres.
--
-- Frister: `fullfort = false` betyr fortsatt «aktiv», så eksisterende spørringer
-- og varselet beholder meningen. Fullført og erstattet skilles med tidspunktene:
--   aktiv      fullfort = false
--   fullført   fullfort = true, erstattet_at er tom
--   erstattet  fullfort = true, erstattet_at er satt
--
-- Utfall: `nedbetalingstilbud` er et tilbud fra kreditor. Saken forblir åpen.
-- `nedbetalingsavtale` er en akseptert avtale, og `oppgjort` er ferdig betalt.
--
-- Kjør i Supabase SQL Editor FØR koden deployes: den nye koden leser kolonnene.
-- Krever 0024. Trygg å kjøre flere ganger.

begin;

alter table public.frister
  add column if not exists fullfort_at timestamptz,
  add column if not exists erstattet_at timestamptz,
  add column if not exists erstattet_av_brev_id uuid
    references public.brev (id) on delete set null;

alter table public.frister drop constraint if exists frister_erstattet_er_lukket;
alter table public.frister
  add constraint frister_erstattet_er_lukket
  check (erstattet_at is null or fullfort);

alter table public.saker drop constraint if exists saker_utfall_check;
alter table public.saker
  add constraint saker_utfall_check
  check (
    utfall in (
      'medhold',
      'delvis_medhold',
      'avvist',
      'nedbetalingstilbud',
      'nedbetalingsavtale',
      'oppgjort'
    )
  );

commit;
