-- Skrivefri kontroll før og etter migrasjon 0029.
--
-- Én SELECT. Leser bare systemkatalogene: ingen rader fra appens tabeller,
-- så ingen personopplysninger hentes. Refererer ikke direkte til tabellene
-- 0029 lager, så den kan kjøres både før og etter.
--
-- Bruk: lim inn i Supabase SQL Editor og kjør. Kolonnen «forventet» sier hva
-- som er riktig etter 0029. Før 0029 skal alt i seksjon 2–4 være «mangler».
-- Kvoteverdiene etterpå: select * from public.kvoter order by handling;

with
tabeller as (
  select cl.relname::text t, cl.relrowsecurity rls
  from pg_class cl join pg_namespace n on n.oid = cl.relnamespace
  where n.nspname = 'public' and cl.relkind = 'r'
),
funksjoner as (
  select p.oid, p.proname::text f, pg_get_function_identity_arguments(p.oid) args, p.prosrc
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select seksjon, objekt, verdi, forventet from (

  select 1 r, '1 krav'::text seksjon, 'lagre_brev (0027)'::text objekt,
         case when exists (select 1 from funksjoner where f = 'lagre_brev') then 'finnes' else 'mangler' end verdi,
         'finnes før 0029 kjøres'::text forventet
  union all
  select 1, '1 krav', 'brev_statusovergang (0027)',
         case when exists (select 1 from funksjoner where f = 'brev_statusovergang') then 'finnes' else 'mangler' end,
         'finnes før 0029 kjøres'
  union all
  select 1, '1 krav', 'frister_status_konsistent (0028)',
         case when exists (select 1 from pg_constraint where conname = 'frister_status_konsistent') then 'finnes' else 'mangler' end,
         'finnes før 0029 kjøres'

  union all
  select 2, '2 tabell', x.t,
         case when exists (select 1 from tabeller where tabeller.t = x.t) then 'finnes' else 'mangler' end,
         'finnes'
  from (values ('lagringsforsok'), ('kvoter'), ('kvotebruk')) x(t)
  union all
  select 2, '2 tabell', x.t || ': RLS på',
         coalesce((select rls::text from tabeller where tabeller.t = x.t), 'tabellen mangler'),
         'true'
  from (values ('lagringsforsok'), ('kvoter'), ('kvotebruk')) x(t)
  union all
  select 2, '2 tabell', x.t || ': authenticated kan lese',
         case when exists (select 1 from tabeller where tabeller.t = x.t)
              then has_table_privilege('authenticated', 'public.' || x.t, 'select')::text
              else 'tabellen mangler' end,
         x.forventet
  from (values ('lagringsforsok', 'true (bare egne rader, via RLS)'), ('kvoter', 'false'), ('kvotebruk', 'false')) x(t, forventet)
  union all
  select 2, '2 tabell', 'lagringsforsok: authenticated kan endre',
         case when exists (select 1 from tabeller where t = 'lagringsforsok')
              then (has_table_privilege('authenticated', 'public.lagringsforsok', 'update')
                    or has_table_privilege('authenticated', 'public.lagringsforsok', 'delete'))::text
              else 'tabellen mangler' end,
         'false'

  union all
  select 3, '3 funksjon', f || '(' || args || ')', 'finnes',
         case f
           when 'brev_datovurdering' then 'finnes'
           when 'reserver_kvote' then 'finnes'
           when 'fullfor_kvote' then 'finnes'
         end
  from funksjoner where f in ('brev_datovurdering', 'reserver_kvote', 'fullfor_kvote')
  union all
  select 3, '3 funksjon', 'lagre_brev: versjon',
         coalesce((
           select case when prosrc like '%lagringsforsok%' and prosrc like '%brev_datovurdering%'
                       then '0029' else 'før 0029' end
           from funksjoner where f = 'lagre_brev'
         ), 'mangler'),
         '0029'
  union all
  select 3, '3 funksjon', x.f || ': ' || x.rolle || ' kan kjøre',
         coalesce((select has_function_privilege(x.rolle, oid, 'execute')::text from funksjoner where f = x.f limit 1), 'funksjonen mangler'),
         x.forventet
  from (values
    ('reserver_kvote', 'anon', 'false'),
    ('reserver_kvote', 'authenticated', 'false'),
    ('reserver_kvote', 'service_role', 'true'),
    ('fullfor_kvote', 'anon', 'false'),
    ('fullfor_kvote', 'authenticated', 'false'),
    ('fullfor_kvote', 'service_role', 'true'),
    ('lagre_brev', 'anon', 'false'),
    ('lagre_brev', 'authenticated', 'true')
  ) x(f, rolle, forventet)

  union all
  select 4, '4 indeks', x.i,
         case when exists (select 1 from pg_class where relname = x.i and relkind = 'i') then 'finnes' else 'mangler' end,
         'finnes'
  from (values
    ('lagringsforsok_pkey'), ('lagringsforsok_sak_id_idx'),
    ('kvoter_pkey'), ('kvotebruk_pkey'), ('kvotebruk_telling_idx'),
    ('kvotebruk_gruppe_idx'), ('kvotebruk_bruker_idx'), ('kvotebruk_forsok_idx')
  ) x(i)

) k
order by r, objekt;
