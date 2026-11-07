-- Skrivefri kontroll før og etter migrasjon 0026, 0027 og 0028.
--
-- Én SELECT. Leser systemkatalogene og teller rader. Ingen rader fra appens
-- tabeller vises, bare antall, så ingen personopplysninger hentes. Refererer
-- ikke direkte til kolonnene 0026 legger til, så den kan kjøres i alle tilstander.
--
-- Bruk: lim inn i Supabase SQL Editor og kjør. Slå av radgrensen i editoren.
-- Kolonnen «forventet» sier hva som er riktig i hver tilstand. Produksjon har
-- per 2026-11-07 kjørt 0026, men ikke 0027 eller 0028.

with
kolonner as (
  select table_name::text t, column_name::text c, is_nullable::text n, data_type::text d
  from information_schema.columns
  where table_schema = 'public'
),
konstr as (
  select cl.relname::text t, k.conname::text navn, pg_get_constraintdef(k.oid) def
  from pg_constraint k
  join pg_class cl on cl.oid = k.conrelid
  join pg_namespace n on n.oid = cl.relnamespace
  where n.nspname = 'public' and cl.relname in ('saker', 'frister', 'brev', 'utkast')
)
select seksjon, objekt, verdi, forventet from (

  select 1 r, '1 miljø'::text seksjon, 'postgres_versjon'::text objekt,
         current_setting('server_version') verdi, 'minst 15'::text forventet

  union all
  select 2, '2 kolonne', 'frister.' || c,
         case when exists (select 1 from kolonner where t = 'frister' and kolonner.c = x.c)
              then 'finnes' else 'mangler' end,
         'etter 0026: finnes'
  from (values ('fullfort_at'), ('erstattet_at'), ('erstattet_av_brev_id')) x(c)

  union all
  select 3, '3 funksjon', x.f,
         case when exists (
           select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = x.f
         ) then 'finnes' else 'mangler' end,
         'etter 0027: finnes'
  from (values ('lagre_brev'), ('brev_statusovergang')) x(f)

  union all
  select 3, '3 funksjon', 'lagre_brev: anon kan kjøre',
         coalesce((
           select has_function_privilege('anon', p.oid, 'execute')::text
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'lagre_brev'
         ), 'funksjonen mangler'),
         'etter 0027: false'

  union all
  select 4, '4 trigger', 'saker_set_sist_endret',
         case when exists (
           select 1 from pg_trigger g join pg_class cl on cl.oid = g.tgrelid
           where cl.relname = 'saker' and g.tgname = 'saker_set_sist_endret' and not g.tgisinternal
         ) then 'finnes' else 'mangler' end,
         'finnes (samtidighetskontrollen bygger på den)'

  union all
  select 5, '5 constraint', t || '.' || navn, def,
         case navn
           when 'brev_id_sak_id_key' then 'finnes (krav fra 0024)'
           when 'frister_brev_sak_fkey' then 'finnes (0024)'
           when 'utkast_brev_sak_fkey' then 'finnes (0024)'
           when 'saker_utfall_check' then 'etter 0026: inneholder nedbetalingstilbud'
           when 'frister_erstattet_av_brev_id_fkey' then 'etter 0026: finnes · etter 0028: borte'
           when 'frister_erstattet_er_lukket' then 'etter 0026: finnes · etter 0028: borte'
           when 'frister_erstattet_brev_sak_fkey' then 'etter 0028: finnes'
           when 'frister_status_konsistent' then 'etter 0028: finnes'
           else ''
         end
  from konstr
  where navn in (
    'brev_id_sak_id_key', 'frister_brev_sak_fkey', 'utkast_brev_sak_fkey',
    'saker_utfall_check', 'saker_status_check',
    'frister_erstattet_brev_sak_fkey', 'frister_status_konsistent',
    'frister_erstattet_av_brev_id_fkey', 'frister_erstattet_er_lukket'
  )

  union all
  select 6, '6 policy', tablename::text || '.' || policyname::text,
         cmd::text || '; using=' || coalesce(qual, '-') || '; with_check=' || coalesce(with_check, '-'),
         'eierskap på sak eller brev (0024)'
  from pg_policies
  where schemaname = 'public' and tablename in ('saker', 'frister', 'brev', 'neste_steg')

  union all
  select 7, '7 data', 'saker: ' || status || ' / ' || coalesce(utfall, 'uten utfall'),
         count(*)::text, 'antall per kombinasjon'
  from public.saker group by status, utfall

  union all
  select 8, '8 data', 'avsluttet med nedbetalingsavtale', count(*)::text,
         'vurderes: åpnes ikke automatisk'
  from public.saker where status = 'fullfort' and utfall = 'nedbetalingsavtale'

  union all
  select 8, '8 data', 'avsluttet med delvis medhold eller avvist', count(*)::text,
         'vurderes: åpnes ikke automatisk'
  from public.saker where status = 'fullfort' and utfall in ('delvis_medhold', 'avvist')

  union all
  select 8, '8 data', 'utfall utenfor tillatt liste', count(*)::text, '0'
  from public.saker
  where utfall is not null and utfall not in (
    'medhold', 'delvis_medhold', 'avvist', 'nedbetalingstilbud', 'nedbetalingsavtale', 'oppgjort'
  )

  union all
  select 8, '8 data', 'frister: fullført (gamle, uten tidspunkt før 0026)', count(*)::text,
         'beholdes som fullført'
  from public.frister where fullfort

  union all
  select 8, '8 data', 'frister: aktive på avsluttede saker', count(*)::text,
         'varsles ikke etter deploy'
  from public.frister f join public.saker s on s.id = f.sak_id
  where not f.fullfort and s.status = 'fullfort'

  union all
  select 8, '8 data', 'frister: aktive, kommende, på saker som venter', count(*)::text,
         'varsles; flyttes ikke automatisk'
  from public.frister f join public.saker s on s.id = f.sak_id
  where not f.fullfort and s.status = 'venter_pa_svar'
    and f.forfallsdato >= (now() at time zone 'Europe/Oslo')::date

  union all
  select 8, '8 data', 'frister: brev fra en annen sak', count(*)::text, '0'
  from public.frister f join public.brev b on b.id = f.brev_id
  where f.sak_id <> b.sak_id

  union all
  select 8, '8 data', 'frister: annen eier enn saken', count(*)::text, '0'
  from public.frister f join public.saker s on s.id = f.sak_id
  where f.bruker_id <> s.bruker_id

) alt
order by r, seksjon, objekt;
