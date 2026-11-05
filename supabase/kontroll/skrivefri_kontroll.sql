-- Skrivefri kontroll av databasen før A2/A3.
--
-- Viser migrasjonsstatus, RLS, aktive policyer, constraints, unike indekser og
-- funksjoner. Spørringen er én SELECT som bare leser systemkatalogene. Den leser
-- ingen rader fra appens tabeller, og henter derfor ingen personopplysninger.
--
-- Bruk: lim hele fila inn i Supabase SQL Editor og kjør. Resultatet er én tabell,
-- sortert etter seksjon. Slå av radgrensen i editoren hvis den er på: resultatet
-- kan bli over 100 rader. Se gjennom før deling: policy- og constraint-tekster
-- gjengis slik de er definert.
--
-- Migrasjonsstatus er utledet: prosjektet har ingen migrasjonstabell, så statusen
-- viser om migrasjonens objekter finnes nå, ikke om fila faktisk ble kjørt.
-- Indekser og innholdet i policyene sammenlignes ikke med migrasjonene.
-- Pilotinnstillingen er en miljøvariabel i Vercel og vises ikke her.

with forventet (migrasjon, krav, tabell, objekt) as (
  values
    ('0001', 'tabell', 'saker', ''),
    ('0001', 'trigger', 'saker', 'saker_set_sist_endret'),
    ('0001', 'policy', 'saker', 'saker_select_egne'),
    ('0001', 'policy', 'saker', 'saker_insert_egne'),
    ('0001', 'policy', 'saker', 'saker_update_egne'),
    ('0001', 'policy', 'saker', 'saker_delete_egne'),
    ('0002', 'tabell', 'frister', ''),
    ('0002', 'policy', 'frister', 'frister_select_egne'),
    ('0002', 'policy', 'frister', 'frister_insert_egne'),
    ('0002', 'policy', 'frister', 'frister_update_egne'),
    ('0002', 'policy', 'frister', 'frister_delete_egne'),
    ('0002', 'tabell', 'neste_steg', ''),
    ('0002', 'policy', 'neste_steg', 'neste_steg_select_egne'),
    ('0002', 'policy', 'neste_steg', 'neste_steg_insert_egne'),
    ('0002', 'policy', 'neste_steg', 'neste_steg_update_egne'),
    ('0002', 'policy', 'neste_steg', 'neste_steg_delete_egne'),
    ('0003', 'erstattet', '', 'document_note fjernes av 0014'),
    ('0004', 'funksjon', '', 'slett_egen_konto'),
    ('0005', 'tabell', 'brev_samtale', ''),
    ('0005', 'policy', 'brev_samtale', 'brev_samtale_select_egne'),
    ('0005', 'policy', 'brev_samtale', 'brev_samtale_insert_egne'),
    ('0005', 'policy', 'brev_samtale', 'brev_samtale_delete_egne'),
    ('0006', 'tabell', 'sendte_varsler', ''),
    ('0006', 'policy', 'sendte_varsler', 'sendte_varsler_select_egne'),
    ('0007', 'kolonne', 'saker', 'kreditor'),
    ('0007', 'kolonne', 'saker', 'opprinnelig_kreditor'),
    ('0007', 'kolonne', 'saker', 'saksnummer'),
    ('0007', 'kolonne', 'saker', 'belop_hovedstol'),
    ('0007', 'kolonne', 'saker', 'belop_totalt'),
    ('0007', 'kolonne', 'saker', 'stadium'),
    ('0008', 'tabell', 'brev', ''),
    ('0008', 'policy', 'brev', 'brev_select_egne'),
    ('0008', 'policy', 'brev', 'brev_insert_egne'),
    ('0008', 'policy', 'brev', 'brev_update_egne'),
    ('0008', 'policy', 'brev', 'brev_delete_egne'),
    ('0009', 'kolonne', 'frister', 'kilde'),
    ('0009', 'kolonne', 'frister', 'brev_id'),
    ('0010', 'kolonne', 'brev_samtale', 'brev_id'),
    ('0011', 'tabell', 'profiler', ''),
    ('0011', 'policy', 'profiler', 'profiler_select_egne'),
    ('0011', 'policy', 'profiler', 'profiler_insert_egne'),
    ('0011', 'policy', 'profiler', 'profiler_update_egne'),
    ('0012', 'funksjon_har', '', 'public.profiler'),
    ('0013', 'tabell', 'utkast', ''),
    ('0013', 'policy', 'utkast', 'utkast_select_egne'),
    ('0013', 'policy', 'utkast', 'utkast_insert_egne'),
    ('0013', 'policy', 'utkast', 'utkast_update_egne'),
    ('0013', 'policy', 'utkast', 'utkast_delete_egne'),
    ('0013', 'funksjon_har', '', 'public.utkast'),
    ('0014', 'ikke_tabell', 'document_note', ''),
    ('0014', 'ikke_kolonne', 'brev_samtale', 'document_note_id'),
    ('0014', 'ikke_null', 'brev_samtale', 'brev_id'),
    ('0014', 'funksjon_uten', '', 'document_note'),
    ('0015', 'kolonne', 'brev', 'avsender_epost'),
    ('0015', 'kolonne', 'utkast', 'sendt_at'),
    ('0016', 'tabell', 'sendte_oppfolginger', ''),
    ('0016', 'policy', 'sendte_oppfolginger', 'sendte_oppfolginger_select_egne'),
    ('0016', 'funksjon_har', '', 'public.sendte_oppfolginger'),
    ('0017', 'kolonne', 'saker', 'utfall'),
    ('0018', 'kolonne', 'brev', 'kostnadslinjer'),
    ('0018', 'kolonne', 'brev', 'gebyrsjekk'),
    ('0019', 'constraint_har', 'saker', 'saker_utfall_check|oppgjort'),
    ('0020', 'constraint_har', 'utkast', 'utkast_type_check|nedbetalingsavtale'),
    ('0021', 'kolonne', 'brev', 'fristfunn'),
    ('0021', 'kolonne', 'brev', 'alvorlig'),
    ('0022', 'kolonne', 'brev', 'belop_hovedstol'),
    ('0022', 'kolonne', 'saker', 'hovedstol_avvik')
),
tabeller as (
  select c.oid, c.relname::text as tabell, c.relrowsecurity, c.relforcerowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
kolonner as (
  select t.tabell, a.attname::text as kolonne, a.attnotnull
  from pg_catalog.pg_attribute a
  join tabeller t on t.oid = a.attrelid
  where a.attnum > 0 and not a.attisdropped
),
constraints as (
  select t.tabell, k.oid, k.conname::text as navn, k.contype::text as kode, k.conindid,
         pg_catalog.pg_get_constraintdef(k.oid) as definisjon
  from pg_catalog.pg_constraint k
  join tabeller t on t.oid = k.conrelid
),
funksjoner as (
  select p.proname::text as navn, p.prosrc, p.prosecdef, p.proconfig, p.proacl::text as tilgang,
         pg_catalog.pg_get_function_identity_arguments(p.oid) as argumenter
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
),
vurdert as (
  select f.migrasjon, f.krav, f.tabell, f.objekt,
    case f.krav
      when 'erstattet' then true
      when 'tabell' then exists (select 1 from tabeller t where t.tabell = f.tabell)
      when 'ikke_tabell' then not exists (select 1 from tabeller t where t.tabell = f.tabell)
      when 'kolonne' then exists (
        select 1 from kolonner k where k.tabell = f.tabell and k.kolonne = f.objekt)
      when 'ikke_kolonne' then not exists (
        select 1 from kolonner k where k.tabell = f.tabell and k.kolonne = f.objekt)
      when 'ikke_null' then exists (
        select 1 from kolonner k
        where k.tabell = f.tabell and k.kolonne = f.objekt and k.attnotnull)
      when 'policy' then exists (
        select 1 from pg_catalog.pg_policies p
        where p.schemaname = 'public' and p.tablename = f.tabell and p.policyname = f.objekt)
      when 'trigger' then exists (
        select 1 from pg_catalog.pg_trigger g
        join tabeller t on t.oid = g.tgrelid
        where t.tabell = f.tabell and g.tgname = f.objekt and not g.tgisinternal)
      when 'funksjon' then exists (select 1 from funksjoner u where u.navn = f.objekt)
      when 'funksjon_har' then exists (
        select 1 from funksjoner u
        where u.navn = 'slett_egen_konto' and position(f.objekt in u.prosrc) > 0)
      when 'funksjon_uten' then exists (
        select 1 from funksjoner u
        where u.navn = 'slett_egen_konto' and position(f.objekt in u.prosrc) = 0)
      when 'constraint_har' then exists (
        select 1 from constraints c
        where c.tabell = f.tabell
          and c.navn = split_part(f.objekt, '|', 1)
          and position(split_part(f.objekt, '|', 2) in c.definisjon) > 0)
      else false
    end as ok
  from forventet f
),
resultat (rekkefolge, seksjon, tabell, objekt, status, detalj) as (
  -- 1. Migrasjonsstatus: én rad per migrasjon, med det som eventuelt mangler.
  select 1, '1 migrasjon', ''::text, v.migrasjon::text,
    case
      when bool_and(v.krav = 'erstattet') then 'ERSTATTET'
      when bool_and(v.ok) then 'OK'
      else 'MANGLER'
    end,
    case
      when bool_and(v.krav = 'erstattet') then max(v.objekt)
      else coalesce(
        string_agg(v.krav || ': ' || concat_ws('.', nullif(v.tabell, ''), nullif(v.objekt, '')), '; ')
          filter (where not v.ok),
        count(*)::text || ' av ' || count(*)::text || ' krav oppfylt')
    end
  from vurdert v
  group by v.migrasjon

  union all

  -- 2. Radsikkerhet per tabell. En tabell uten RLS eller uten policy skal forklares.
  select 2, '2 rls', t.tabell, '',
    case when t.relrowsecurity then 'RLS PÅ' else 'RLS AV' end,
    'force=' || t.relforcerowsecurity::text || '; policyer='
      || (select count(*) from pg_catalog.pg_policies p
          where p.schemaname = 'public' and p.tablename = t.tabell)::text
  from tabeller t

  union all

  -- 3. Aktive policyer.
  select 3, '3 policy', p.tablename::text, p.policyname::text, p.cmd::text,
    p.permissive::text || '; roller=' || array_to_string(p.roles, ',')
      || '; using=' || coalesce(p.qual, '-')
      || '; with_check=' || coalesce(p.with_check, '-')
  from pg_catalog.pg_policies p
  where p.schemaname = 'public'

  union all

  -- 4. Constraints: primærnøkkel, fremmednøkkel, unik og check.
  select 4, '4 constraint', c.tabell, c.navn,
    case c.kode
      when 'p' then 'PRIMÆRNØKKEL'
      when 'f' then 'FREMMEDNØKKEL'
      when 'u' then 'UNIK'
      when 'c' then 'CHECK'
      else c.kode
    end,
    c.definisjon
  from constraints c

  union all

  -- 5. Unike indekser som ikke hører til en constraint.
  select 5, '5 unik indeks', t.tabell, ic.relname::text, 'UNIK',
    pg_catalog.pg_get_indexdef(i.indexrelid)
  from pg_catalog.pg_index i
  join tabeller t on t.oid = i.indrelid
  join pg_catalog.pg_class ic on ic.oid = i.indexrelid
  where i.indisunique
    and not exists (select 1 from constraints c where c.conindid = i.indexrelid)

  union all

  -- 6. Funksjoner: rettigheter og search_path, ikke kildekoden.
  select 6, '6 funksjon', '', u.navn || '(' || u.argumenter || ')',
    case when u.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end,
    'config=' || coalesce(array_to_string(u.proconfig, ','), '-')
      || '; tilgang=' || coalesce(u.tilgang, 'standard')
  from funksjoner u
)
select seksjon, tabell, objekt, status, detalj
from resultat
order by rekkefolge, tabell, objekt;
