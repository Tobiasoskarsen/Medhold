-- A3: foreldreeierskap. Policyene sjekket bare at raden hadde brukerens egen
-- bruker_id, ikke hvem som eier saken eller brevet raden kobles til. Fremmednøkler
-- ser ikke RLS, så en bruker kunne legge en rad på en annen brukers sak. Påminnelses-
-- jobben kjører med service-rollen og henter sakstittelen via sak_id, så en slik
-- frist ville gitt angriperen tittelen på e-post.
--
-- Etter dette må saken eller brevet tilhøre brukeren, og et brev koblet til en frist
-- eller et utkast må høre til samme sak.
--
-- Kjør i Supabase SQL Editor etter 0023. Krever Postgres 15 eller nyere. Trygg å
-- kjøre flere ganger. Stopper uten å endre noe hvis eksisterende data bryter reglene.

begin;

do $$
declare
  antall bigint;
begin
  select
      (select count(*) from public.brev x join public.saker s on s.id = x.sak_id where x.bruker_id <> s.bruker_id)
    + (select count(*) from public.frister x join public.saker s on s.id = x.sak_id where x.bruker_id <> s.bruker_id)
    + (select count(*) from public.neste_steg x join public.saker s on s.id = x.sak_id where x.bruker_id <> s.bruker_id)
    + (select count(*) from public.utkast x join public.saker s on s.id = x.sak_id where x.bruker_id <> s.bruker_id)
    + (select count(*) from public.brev_samtale x join public.brev b on b.id = x.brev_id where x.bruker_id <> b.bruker_id)
    + (select count(*) from public.frister x join public.brev b on b.id = x.brev_id where x.sak_id <> b.sak_id)
    + (select count(*) from public.utkast x join public.brev b on b.id = x.brev_id where x.sak_id <> b.sak_id)
  into antall;

  if antall > 0 then
    raise exception 'A3 stoppet: % rader bryter eierskapsreglene. Ingenting er endret.', antall;
  end if;
end;
$$;

-- Brev på frister og utkast må høre til samme sak. Slettes brevet, nullstilles bare
-- brev_id, slik at fristen eller utkastet blir stående på saken.
alter table public.frister drop constraint if exists frister_brev_id_fkey;
alter table public.frister drop constraint if exists frister_brev_sak_fkey;
alter table public.utkast drop constraint if exists utkast_brev_id_fkey;
alter table public.utkast drop constraint if exists utkast_brev_sak_fkey;
alter table public.brev drop constraint if exists brev_id_sak_id_key;

alter table public.brev
  add constraint brev_id_sak_id_key unique (id, sak_id);

alter table public.frister
  add constraint frister_brev_sak_fkey
  foreign key (brev_id, sak_id) references public.brev (id, sak_id)
  on delete set null (brev_id);

alter table public.utkast
  add constraint utkast_brev_sak_fkey
  foreign key (brev_id, sak_id) references public.brev (id, sak_id)
  on delete set null (brev_id);

-- brev
drop policy if exists "brev_insert_egne" on public.brev;
create policy "brev_insert_egne" on public.brev
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

drop policy if exists "brev_update_egne" on public.brev;
create policy "brev_update_egne" on public.brev
  for update using (auth.uid() = bruker_id)
  with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

-- frister
drop policy if exists "frister_insert_egne" on public.frister;
create policy "frister_insert_egne" on public.frister
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

drop policy if exists "frister_update_egne" on public.frister;
create policy "frister_update_egne" on public.frister
  for update using (auth.uid() = bruker_id)
  with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

-- neste_steg
drop policy if exists "neste_steg_insert_egne" on public.neste_steg;
create policy "neste_steg_insert_egne" on public.neste_steg
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

drop policy if exists "neste_steg_update_egne" on public.neste_steg;
create policy "neste_steg_update_egne" on public.neste_steg
  for update using (auth.uid() = bruker_id)
  with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

-- utkast
drop policy if exists "utkast_insert_egne" on public.utkast;
create policy "utkast_insert_egne" on public.utkast
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

drop policy if exists "utkast_update_egne" on public.utkast;
create policy "utkast_update_egne" on public.utkast
  for update using (auth.uid() = bruker_id)
  with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.saker s where s.id = sak_id and s.bruker_id = auth.uid())
  );

-- brev_samtale (har ingen update-policy)
drop policy if exists "brev_samtale_insert_egne" on public.brev_samtale;
create policy "brev_samtale_insert_egne" on public.brev_samtale
  for insert with check (
    auth.uid() = bruker_id
    and exists (select 1 from public.brev b where b.id = brev_id and b.bruker_id = auth.uid())
  );

commit;
