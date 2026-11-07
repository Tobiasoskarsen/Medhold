-- Rettet utgave av 0014, som aldri ble kjørt i produksjon. Erstatter den fila.
--
-- Feilen: brev_samtale.document_note_id er fortsatt obligatorisk, mens appen bare
-- fyller ut brev_id. All lagring av brevchat feiler derfor, og feilen er usynlig
-- fordi appen ikke sjekker den. Etter dette lagres meldingene.
--
-- Forskjeller fra 0014: overskriver ikke slett_egen_konto() (0014 ville fjernet
-- sendte_oppfolginger fra funksjonen), sletter ingen rader, og stopper hvis det
-- finnes data som ville gått tapt.
--
-- Kjør i Supabase SQL Editor. Uavhengig av 0023 og 0024. Trygg å kjøre flere ganger.

begin;

do $$
declare
  notater bigint := 0;
  uten_brev bigint;
begin
  if to_regclass('public.document_note') is not null then
    execute 'select count(*) from public.document_note' into notater;
  end if;
  select count(*) into uten_brev from public.brev_samtale where brev_id is null;

  if notater > 0 or uten_brev > 0 then
    raise exception 'Stoppet: document_note har % rader og brev_samtale har % rader uten brev_id. Ingenting er endret.',
      notater, uten_brev;
  end if;
end;
$$;

alter table public.brev_samtale drop column if exists document_note_id;
alter table public.brev_samtale alter column brev_id set not null;

drop table if exists public.document_note;

commit;
