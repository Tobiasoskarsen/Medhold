-- Fase 4 (GDPR): la en innlogget bruker slette HELE sin egen konto og data.
-- Sletting av auth.users kaskaderer til saker, frister, neste_steg og
-- document_note (alle har on delete cascade mot auth.users).
-- Kjør i Supabase SQL Editor.

create or replace function public.slett_egen_konto()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  -- auth.uid() leser brukeren fra forespørselens JWT. Funksjonen kan derfor
  -- kun slette den som er innlogget — aldri andre.
  delete from auth.users where id = auth.uid();
end;
$$;

-- Kun innloggede brukere kan kalle funksjonen, og kun for seg selv.
revoke all on function public.slett_egen_konto() from public;
grant execute on function public.slett_egen_konto() to authenticated;
