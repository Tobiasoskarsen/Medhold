-- A2: plan-lås. Innloggede brukere kunne opprette og endre sin egen profilrad, og
-- dermed sette plan = 'pluss' selv. Appen leser bare profiler (lib/plan.ts), så
-- brukeren trenger ingen skrivetilgang. Ekte betaling skal skrive med service-rollen.
--
-- Fjerner også anon-tilgangen til slett_egen_konto(): 0016 trakk tilgangen fra
-- public, men Supabase gir anon egen tilgang. Uten innlogging er auth.uid() tom,
-- så kallet slettet ingenting, men funksjonen skal ikke kunne kalles uten innlogging.
--
-- Kjør i Supabase SQL Editor etter 0022. Trygg å kjøre flere ganger.

begin;

drop policy if exists "profiler_insert_egne" on public.profiler;
drop policy if exists "profiler_update_egne" on public.profiler;

-- Dobbelt sikring: en ny policy alene skal ikke kunne åpne skrivetilgangen igjen.
revoke all on table public.profiler from anon;
revoke insert, update, delete, truncate on table public.profiler from authenticated;

revoke all on function public.slett_egen_konto() from public;
revoke all on function public.slett_egen_konto() from anon;
grant execute on function public.slett_egen_konto() to authenticated;

commit;
