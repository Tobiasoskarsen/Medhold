-- Skrivefri preflight før og etter migrasjon 0032.
--
-- Én SELECT. Leser bare systemkatalogene og teller rader. Ingen rader fra
-- appens tabeller vises, så ingen personopplysninger hentes. Kan kjøres både
-- før og etter 0032.
--
-- Bruk: lim inn i Supabase SQL Editor for TESTPROSJEKTET og kjør. Kolonnen
-- «forventet» sier hva som er riktig etter 0032.

with funksjoner as (
  select p.oid, p.proname::text f, p.prosrc
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select seksjon, objekt, verdi, forventet from (

  select 1 r, '1 krav'::text seksjon, 'brev_datovurdering (0029)'::text objekt,
         case when exists (select 1 from funksjoner where f = 'brev_datovurdering') then 'finnes' else 'mangler' end verdi,
         'finnes før 0032 kjøres'::text forventet
  union all
  select 1, '1 krav', 'lagringsforsok (0029)',
         case when to_regclass('public.lagringsforsok') is not null then 'finnes' else 'mangler' end,
         'finnes før 0032 kjøres'
  union all
  select 1, '1 krav', 'utkast.sendt_at (0015)',
         case when exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'utkast' and column_name = 'sendt_at'
         ) then 'finnes' else 'mangler' end,
         'finnes før 0032 kjøres'

  union all
  select 2, '2 funksjon', 'lagre_brev: versjon',
         coalesce((
           select case
             when prosrc like '%v_sist_sendt%' then '0032'
             when prosrc like '%lagringsforsok%' then '0029'
             else 'før 0029'
           end
           from funksjoner where f = 'lagre_brev'
         ), 'mangler'),
         '0032'
  union all
  select 2, '2 funksjon', 'lagre_brev: ' || x.rolle || ' kan kjøre',
         coalesce((select has_function_privilege(x.rolle, oid, 'execute')::text from funksjoner where f = 'lagre_brev' limit 1), 'funksjonen mangler'),
         x.forventet
  from (values ('anon', 'false'), ('authenticated', 'true')) x(rolle, forventet)

  union all
  select 3, '3 data', 'saker som venter på svar',
         (select count(*)::text from public.saker where status = 'venter_pa_svar'),
         'uendret før og etter (0032 endrer ingen rader)'

) k
order by r, objekt;
