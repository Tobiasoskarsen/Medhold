-- 0030 fjernet PUBLIC-granten, men Supabase kan også ha direkte
-- standardgrants til anon. Fjern begge eksplisitt; eiersjekk/RLS beholdes.
begin;
revoke all on function public.registrer_utkast_sendt(uuid, integer) from public, anon;
grant execute on function public.registrer_utkast_sendt(uuid, integer) to authenticated;
commit;
