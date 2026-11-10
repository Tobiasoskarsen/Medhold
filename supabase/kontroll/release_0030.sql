-- Produksjons-preflight: bare systemkataloger, ingen dokumenter/persondata.
-- Kan kjøres før/etter 0030; kjører ingen migrasjon og gir ingen rettigheter.
-- Sammenhold med for_0026_0028.sql og for_0029.sql. Objekttreff er ikke
-- dokumentasjon på at hele migrasjonen er kjørt. Les funksjonsdefinisjonene.
with objekter as (
  select 'kolonne'::text kategori, c.table_name || '.' || c.column_name objekt,
    c.data_type || ', nullable=' || c.is_nullable || ', default=' || coalesce(c.column_default, 'NULL') detalj
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'utkast'
    and c.column_name in ('versjon', 'sendt_innhold', 'vakt_fakta', 'brev_id', 'sendt_at')
  union all
  select 'constraint', con.conname, pg_get_constraintdef(con.oid) || ', validert=' || con.convalidated
  from pg_constraint con join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
  where ns.nspname = 'public' and cl.relname in ('utkast', 'brev', 'frister')
  union all
  select 'rls', cl.relname, 'aktiv=' || cl.relrowsecurity || ', force=' || cl.relforcerowsecurity
  from pg_class cl join pg_namespace ns on ns.oid = cl.relnamespace
  where ns.nspname = 'public' and cl.relname in ('saker', 'brev', 'utkast', 'frister', 'kvoter', 'kvotebruk')
  union all
  select 'policy', tablename || '.' || policyname,
    cmd || ', roller=' || roles::text || ', using=' || coalesce(qual, 'NULL') || ', check=' || coalesce(with_check, 'NULL')
  from pg_policies where schemaname = 'public'
    and tablename in ('saker', 'brev', 'utkast', 'frister', 'kvoter', 'kvotebruk')
  union all
  select 'trigger', tr.tgname, pg_get_triggerdef(tr.oid)
  from pg_trigger tr join pg_class cl on cl.oid = tr.tgrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
  where ns.nspname = 'public' and cl.relname = 'utkast' and not tr.tgisinternal
  union all
  select 'funksjon', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    'security_definer=' || p.prosecdef || ', anon_execute=' || has_function_privilege('anon', p.oid, 'EXECUTE')
    || ', authenticated_execute=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')
    || E'\n' || pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname in ('registrer_utkast_sendt', 'lagre_brev', 'reserver_kvote', 'fullfor_kvote')
)
select kategori, objekt, detalj from objekter order by kategori, objekt;
