-- Peças para a interface da etapa 2: contexto do utilizador, lista da plataforma,
-- e-mail no perfil e verificação em duas etapas obrigatória para a plataforma.

-- E-mail no perfil, para listas de equipe (colegas do mesmo estabelecimento já veem o perfil).
alter table public.profiles add column email text not null default '';

update public.profiles p set email = coalesce(u.email, '') from auth.users u where u.id = p.id;

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.email, ''));
  return new;
end;
$$;

create function app.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function app.sync_profile_email();

-- O e-mail vem do Auth; o utilizador não o altera pelo perfil.
create function app.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email and (select auth.uid()) is not null then
    raise exception 'O e-mail é gerido pela autenticação.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard before update on public.profiles
  for each row execute function app.guard_profile_update();

-- A plataforma só age com sessão verificada em duas etapas (AAL2).
create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

-- Diz à interface se o utilizador é da plataforma, mesmo antes da verificação em duas etapas.
create function public.my_platform_access()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.platform_admins where user_id = (select auth.uid())) then 'none'
    when coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2' then 'verified'
    else 'needs_mfa'
  end
$$;

-- Estabelecimentos do utilizador, com cargo e permissões. Só devolve as linhas do próprio utilizador.
create function public.my_establishments()
returns table (
  establishment_id uuid,
  name text,
  kind text,
  establishment_status text,
  membership_status text,
  role_name text,
  permissions text[],
  is_owner boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name, e.kind, e.status, m.status, r.name, r.permissions, r.system_key = 'owner'
  from public.memberships m
  join public.establishments e on e.id = m.establishment_id
  join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid())
  order by e.name
$$;

-- Lista da plataforma: dados de conta, nunca dados operacionais.
create function public.platform_establishments()
returns table (
  id uuid,
  name text,
  legal_name text,
  cnpj text,
  kind text,
  status text,
  created_at timestamptz,
  member_count bigint,
  owner_name text,
  owner_email text,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Apenas a plataforma.' using errcode = '42501';
  end if;

  return query
  select
    e.id, e.name, e.legal_name, e.cnpj, e.kind, e.status, e.created_at,
    (select count(*) from public.memberships m where m.establishment_id = e.id),
    owner.full_name,
    owner.email,
    (select max(u.last_sign_in_at) from public.memberships m join auth.users u on u.id = m.user_id
      where m.establishment_id = e.id)
  from public.establishments e
  left join lateral (
    select p.full_name, p.email
    from public.memberships m
    join public.roles r on r.id = m.role_id and r.system_key = 'owner'
    join public.profiles p on p.id = m.user_id
    where m.establishment_id = e.id
    order by m.created_at
    limit 1
  ) owner on true
  order by e.created_at desc;
end;
$$;

-- Servidor (secret key): encontra o utilizador de um e-mail, para convites.
drop function app.user_id_by_email(text);

create function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

revoke execute on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

revoke execute on function public.my_platform_access(), public.my_establishments(),
  public.platform_establishments() from public, anon;
grant execute on function public.my_platform_access(), public.my_establishments(),
  public.platform_establishments() to authenticated;
