-- Pålitelige frister og saksstatus. Additiv: ingen rader slettes eller endres.
--
-- Frister: `fullfort = false` betyr fortsatt «aktiv», så eksisterende spørringer
-- og varselet beholder meningen. Fullført og erstattet skilles med tidspunktene:
--   aktiv      fullfort = false, ingen tidspunkt eller kobling
--   fullført   fullfort = true, erstattet_at er tom
--   erstattet  fullfort = true, erstattet_at er satt
-- Eldre fullførte frister uten tidspunkt er gyldige og tolkes som fullført.
--
-- Erstatningsbrevet må høre til samme sak som fristen (sammensatt fremmednøkkel,
-- som 0024 bruker for brev_id). Slettes brevet, nullstilles bare koblingen.
--
-- Utfall: `nedbetalingstilbud` er et tilbud fra kreditor. Saken forblir åpen.
--
-- Kjør i Supabase SQL Editor FØR koden deployes: den nye koden leser kolonnene.
-- Krever 0024 (brev_id_sak_id_key) og Postgres 15+. Trygg å kjøre flere ganger.

begin;

alter table public.frister
  add column if not exists fullfort_at timestamptz,
  add column if not exists erstattet_at timestamptz,
  add column if not exists erstattet_av_brev_id uuid;

alter table public.frister drop constraint if exists frister_erstattet_av_brev_id_fkey;
alter table public.frister drop constraint if exists frister_erstattet_brev_sak_fkey;
alter table public.frister
  add constraint frister_erstattet_brev_sak_fkey
  foreign key (erstattet_av_brev_id, sak_id) references public.brev (id, sak_id)
  on delete set null (erstattet_av_brev_id);

alter table public.frister drop constraint if exists frister_erstattet_er_lukket;
alter table public.frister drop constraint if exists frister_status_konsistent;
alter table public.frister
  add constraint frister_status_konsistent
  check (
    (
      (not fullfort and fullfort_at is null and erstattet_at is null)
      or (fullfort and (fullfort_at is null or erstattet_at is null))
    )
    and (erstattet_av_brev_id is null or erstattet_at is not null)
  );

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
