-- S1-C. Kun testet lokalt; krever godkjenning før kjøring i Supabase.
begin;
alter table public.utkast add column if not exists versjon integer not null default 1;
alter table public.utkast add column if not exists sendt_innhold text;
alter table public.utkast add column if not exists vakt_fakta jsonb;
-- Gamle sendt-rader har ikke en bevist historisk slutttekst. Ikke konstruer den.
create or replace function public.utkast_versjonsvern() returns trigger
language plpgsql set search_path=public as $$
begin
  if old.sendt_at is not null and
    (new.sendt_innhold is distinct from old.sendt_innhold or new.sendt_at is distinct from old.sendt_at) then
    raise exception 'Sendt tekst kan ikke overskrives';
  end if;
  if old.sendt_at is null and new.sendt_at is not null then
    new.sendt_innhold := new.innhold;
  end if;
  new.versjon := old.versjon + 1;
  return new;
end; $$;
drop trigger if exists utkast_versjonsvern on public.utkast;
create trigger utkast_versjonsvern before update on public.utkast
for each row execute function public.utkast_versjonsvern();

create or replace function public.registrer_utkast_sendt(p_id uuid,p_versjon integer)
returns uuid language plpgsql security invoker set search_path=public as $$
declare u public.utkast;
begin
  select * into u from utkast where id=p_id and bruker_id=auth.uid() for update;
  if not found then raise exception 'Fant ikke utkastet'; end if;
  if u.versjon <> p_versjon then raise exception 'Utkastet er endret. Åpne det på nytt'; end if;
  if u.sendt_at is null then
    update utkast set sendt_at=now() where id=u.id;
    update saker set status='venter_pa_svar' where id=u.sak_id and bruker_id=auth.uid() and status='aktiv';
  end if;
  return u.sak_id;
end; $$;
revoke all on function public.registrer_utkast_sendt(uuid,integer) from public;
grant execute on function public.registrer_utkast_sendt(uuid,integer) to authenticated;
commit;
