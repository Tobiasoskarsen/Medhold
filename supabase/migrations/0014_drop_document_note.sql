-- Medhold Fase 3: fullfør cutover fra document_note til brev (utsatt fra Fase 1).
-- Nå bruker all kode `brev`/`brev_samtale.brev_id`, så vi kan gjøre brev_id
-- obligatorisk, droppe den gamle koblingen og selve document_note-tabellen.
-- Kjør i Supabase SQL Editor etter 0013 — OG etter at Fase 3-koden er i drift.

-- Sikkerhetsnett: fyll evt. manglende brev_id fra den gamle kolonnen.
update public.brev_samtale
  set brev_id = document_note_id
  where brev_id is null and document_note_id is not null;

-- Fjern samtale-rader som ikke lot seg koble til et brev (skal normalt være 0).
delete from public.brev_samtale where brev_id is null;

alter table public.brev_samtale drop column if exists document_note_id;
alter table public.brev_samtale alter column brev_id set not null;

drop table if exists public.document_note cascade;

-- slett_egen_konto() må ikke lenger referere document_note.
create or replace function public.slett_egen_konto()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from public.utkast where bruker_id = auth.uid();
  delete from public.brev_samtale where bruker_id = auth.uid();
  delete from public.sendte_varsler where bruker_id = auth.uid();
  delete from public.frister where bruker_id = auth.uid();
  delete from public.neste_steg where bruker_id = auth.uid();
  delete from public.brev where bruker_id = auth.uid();
  delete from public.profiler where bruker_id = auth.uid();
  delete from public.saker where bruker_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.slett_egen_konto() from public;
grant execute on function public.slett_egen_konto() to authenticated;
