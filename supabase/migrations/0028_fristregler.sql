-- Strammere regler for fristene, oppå 0026 slik den er kjørt i produksjon.
-- 0026 er ikke endret etter at den ble kjørt; endringene ligger her i stedet.
--
-- 1. Erstatningsbrevet må høre til samme sak som fristen. 0026 la en enkel
--    fremmednøkkel på erstattet_av_brev_id. Den byttes med en sammensatt
--    (erstattet_av_brev_id, sak_id), slik 0024 gjør for brev_id. Slettes brevet,
--    nullstilles bare koblingen.
-- 2. Fristmodellen håndheves:
--      aktiv      fullfort = false, ingen tidspunkt eller kobling
--      fullført   fullfort = true, erstattet_at er tom
--      erstattet  fullfort = true, erstattet_at er satt
--    Eldre fullførte frister uten tidspunkt er gyldige og tolkes som fullført.
--    Erstatter frister_erstattet_er_lukket fra 0026.
--
-- Endrer ingen rader. Feiler hvis eksisterende data bryter reglene, og ruller da
-- tilbake uten å endre noe. Krever 0024 (brev_id_sak_id_key), 0026 og Postgres 15+.
-- Kjør i Supabase SQL Editor etter 0026, FØR koden deployes. Trygg å kjøre flere
-- ganger.

begin;

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

commit;
