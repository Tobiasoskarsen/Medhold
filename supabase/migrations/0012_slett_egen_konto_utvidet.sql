-- Medhold Fase 1: utvid slett_egen_konto() til å dekke alle tabeller
-- (guardrail). Sletting av auth.users kaskaderer allerede, men vi sletter
-- eksplisitt først slik at funksjonen forblir korrekt selv om en framtidig
-- tabell skulle mangle «on delete cascade». Kjør etter 0011_profiler.sql.

create or replace function public.slett_egen_konto()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- auth.uid() leser brukeren fra forespørselens JWT — funksjonen kan kun
  -- slette den som er innlogget. Barn før foreldre for å unngå FK-feil.
  delete from public.brev_samtale where bruker_id = auth.uid();
  delete from public.sendte_varsler where bruker_id = auth.uid();
  delete from public.frister where bruker_id = auth.uid();
  delete from public.neste_steg where bruker_id = auth.uid();
  delete from public.brev where bruker_id = auth.uid();
  delete from public.document_note where bruker_id = auth.uid();
  delete from public.profiler where bruker_id = auth.uid();
  delete from public.saker where bruker_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.slett_egen_konto() from public;
grant execute on function public.slett_egen_konto() to authenticated;
