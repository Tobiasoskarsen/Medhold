-- Tilbakeføring av migrasjon 0029. Kjøres BARE hvis 0029 må fjernes.
--
-- Rekkefølge: rull tilbake koden (Vercel) FØRST. Ny kode kaller
-- reserver_kvote og stopper AI-funksjonene hvis den mangler.
--
-- Etterpå: kjør denne fila, og deretter 0027_lagre_brev_atomisk.sql på nytt.
-- 0027 gjenoppretter lagre_brev slik den var. Brev, saker og frister berøres
-- ikke. Kvitteringene for lagring og kvotebruken slettes.

begin;

drop function if exists public.reserver_kvote(jsonb, uuid, integer);
drop function if exists public.fullfor_kvote(uuid, boolean, jsonb);
drop function if exists public.brev_datovurdering(date, date);
drop table if exists public.kvotebruk;
drop table if exists public.kvoter;
drop table if exists public.lagringsforsok;

commit;
