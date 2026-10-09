-- Etapa 2 — Tenancy, cargos, permissões e auditoria.
-- O estabelecimento é o cliente (tenant). Todas as tabelas de cliente têm establishment_id
-- e RLS ativa. Funções auxiliares ficam no esquema `app`, fora da API pública.

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Catálogo de permissões (fixo no sistema)
-- ---------------------------------------------------------------------------
create function app.all_permissions()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'establishment.manage',
    'members.manage',
    'settings.manage',
    'assets.manage',
    'work_orders.create',
    'work_orders.read_all',
    'work_orders.assign',
    'work_orders.manage',
    'work_orders.execute',
    'costs.read',
    'costs.write',
    'preventive.manage',
    'displays.manage',
    'dashboard.read',
    'audit.read'
  ]::text[]
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  legal_name text not null check (length(trim(legal_name)) between 2 and 200),
  cnpj text not null unique check (cnpj ~ '^[0-9]{14}$'),
  kind text not null check (kind in ('motel', 'hotel', 'other')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  timezone text not null default 'America/Sao_Paulo',
  logo_path text,
  accent_color text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  sla_hours jsonb not null default '{"critical": 4, "high": 24, "medium": 72, "low": 168}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 120),
  phone text check (length(phone) <= 30),
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 60),
  permissions text[] not null default '{}' check (permissions <@ app.all_permissions()),
  system_key text check (system_key in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, name),
  unique (establishment_id, system_key),
  unique (establishment_id, id)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, user_id),
  -- O cargo tem de pertencer ao mesmo estabelecimento.
  foreign key (establishment_id, role_id) references public.roles (establishment_id, id)
);

create index memberships_user_idx on public.memberships (user_id);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  establishment_id uuid references public.establishments (id) on delete restrict,
  actor_type text not null check (actor_type in ('user', 'system', 'device', 'platform')),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  changed_fields text[],
  origin text not null default 'web',
  created_at timestamptz not null default now()
);

create index audit_events_establishment_idx on public.audit_events (establishment_id, created_at desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Funções de autorização (usadas pelas políticas RLS)
-- ---------------------------------------------------------------------------
create function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

create function app.is_member(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.establishments e on e.id = m.establishment_id
    where m.establishment_id = p_establishment_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and e.status = 'active'
  )
$$;

create function app.has_permission(p_establishment_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    join public.establishments e on e.id = m.establishment_id
    where m.establishment_id = p_establishment_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and e.status = 'active'
      and p_permission = any (r.permissions)
  )
$$;

create function app.is_owner(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.establishment_id = p_establishment_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and r.system_key = 'owner'
  )
$$;

-- Colegas de estabelecimento podem ver o nome uns dos outros.
create function app.shares_establishment(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.establishment_id = mine.establishment_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.user_id = p_user_id
  )
$$;

grant execute on function app.all_permissions(), app.is_platform_admin(), app.is_member(uuid),
  app.has_permission(uuid, text), app.is_owner(uuid), app.shares_establishment(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Auditoria genérica (append-only)
-- ---------------------------------------------------------------------------
create function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_ignored text[] := array['updated_at', 'created_at'];
  v_changed text[];
  v_establishment_id uuid;
  v_actor uuid := (select auth.uid());
  v_actor_type text;
begin
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into v_changed
    from jsonb_each(v_new) n
    where not (key = any (v_ignored))
      and n.value is distinct from v_old -> key;
    if v_changed is null then
      return null; -- nada relevante mudou
    end if;
  end if;

  v_establishment_id := case
    when tg_table_name = 'establishments' then (v_row ->> 'id')::uuid
    else (v_row ->> 'establishment_id')::uuid
  end;

  v_actor_type := case
    when v_actor is null then 'system'
    when app.is_platform_admin() and not app.is_member(v_establishment_id) then 'platform'
    else 'user'
  end;

  insert into public.audit_events
    (establishment_id, actor_type, actor_id, action, entity_type, entity_id, before, after, changed_fields)
  values (
    -- Um estabelecimento apagado não pode receber eventos (FK); guarda-se o id no próprio evento.
    case when tg_table_name = 'establishments' and tg_op = 'DELETE' then null else v_establishment_id end,
    v_actor_type,
    v_actor,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    v_old,
    v_new,
    v_changed
  );
  return null;
end;
$$;

-- Ninguém altera ou apaga eventos de auditoria; correções são novos eventos.
revoke insert, update, delete, truncate on public.audit_events from anon, authenticated, service_role;

create trigger audit after insert or update or delete on public.establishments
  for each row execute function app.audit_row();
create trigger audit after insert or update or delete on public.roles
  for each row execute function app.audit_row();
create trigger audit after insert or update or delete on public.memberships
  for each row execute function app.audit_row();

-- ---------------------------------------------------------------------------
-- Gatilhos de integridade
-- ---------------------------------------------------------------------------
create function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch before update on public.establishments for each row execute function app.touch_updated_at();
create trigger touch before update on public.profiles for each row execute function app.touch_updated_at();
create trigger touch before update on public.roles for each row execute function app.touch_updated_at();
create trigger touch before update on public.memberships for each row execute function app.touch_updated_at();

-- Perfil criado automaticamente para cada utilizador do Auth.
create function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- Campos do estabelecimento que só a plataforma ZMOLAK altera.
create function app.guard_establishment_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not app.is_platform_admin() and (
    new.status is distinct from old.status
    or new.cnpj is distinct from old.cnpj
    or new.legal_name is distinct from old.legal_name
    or new.kind is distinct from old.kind
  ) then
    raise exception 'Somente a plataforma pode alterar estado, CNPJ, razão social ou tipo.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard before update on public.establishments
  for each row execute function app.guard_establishment_update();

-- Cargos de sistema: o Proprietário tem sempre todas as permissões e não muda;
-- cargos de sistema não são apagados.
create function app.guard_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.system_key is not null and (select auth.uid()) is not null then
      raise exception 'Cargos padrão não podem ser apagados.' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.system_key is distinct from old.system_key then
    raise exception 'O tipo de cargo não pode ser alterado.' using errcode = '42501';
  end if;

  if new.system_key = 'owner' then
    new.permissions := app.all_permissions();
  end if;

  if tg_op = 'INSERT' and new.system_key is not null and (select auth.uid()) is not null
     and not app.is_platform_admin() then
    raise exception 'Cargos padrão são criados pelo sistema.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger guard before insert or update or delete on public.roles
  for each row execute function app.guard_roles();

-- Proprietários: só outro Proprietário atribui ou retira o cargo, e o estabelecimento
-- mantém sempre pelo menos um Proprietário ativo.
create function app.guard_memberships()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_role uuid;
  v_touches_owner boolean;
  v_remaining int;
begin
  select id into v_owner_role from public.roles
  where establishment_id = coalesce(new.establishment_id, old.establishment_id) and system_key = 'owner';

  v_touches_owner := (tg_op <> 'INSERT' and old.role_id = v_owner_role)
                  or (tg_op <> 'DELETE' and new.role_id = v_owner_role);

  if v_touches_owner and (select auth.uid()) is not null
     and not app.is_platform_admin()
     and not app.is_owner(coalesce(new.establishment_id, old.establishment_id)) then
    raise exception 'Somente um Proprietário pode gerir Proprietários.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.establishment_id is distinct from old.establishment_id then
    raise exception 'Uma membership não muda de estabelecimento.' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger guard before insert or update or delete on public.memberships
  for each row execute function app.guard_memberships();

create function app.ensure_owner_remains()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_establishment uuid := coalesce(new.establishment_id, old.establishment_id);
begin
  if exists (select 1 from public.establishments where id = v_establishment)
     and not exists (
       select 1 from public.memberships m
       join public.roles r on r.id = m.role_id
       where m.establishment_id = v_establishment and m.status = 'active' and r.system_key = 'owner'
     )
     and exists (select 1 from public.memberships where establishment_id = v_establishment) then
    raise exception 'O estabelecimento precisa de pelo menos um Proprietário ativo.' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger ensure_owner_remains
  after update or delete on public.memberships
  deferrable initially deferred
  for each row execute function app.ensure_owner_remains();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.establishments enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.memberships enable row level security;
alter table public.platform_admins enable row level security;
alter table public.audit_events enable row level security;

create policy "membros e plataforma veem o estabelecimento" on public.establishments
  for select to authenticated
  using (app.is_member(id) or app.is_platform_admin());

create policy "gestão do estabelecimento edita dados básicos" on public.establishments
  for update to authenticated
  using (app.has_permission(id, 'establishment.manage') or app.is_platform_admin())
  with check (app.has_permission(id, 'establishment.manage') or app.is_platform_admin());

create policy "ver o próprio perfil e o de colegas" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or app.shares_establishment(id));

create policy "editar o próprio perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "membros veem os cargos" on public.roles
  for select to authenticated
  using (app.is_member(establishment_id));

create policy "gestão de equipe cria cargos" on public.roles
  for insert to authenticated
  with check (app.has_permission(establishment_id, 'members.manage'));

create policy "gestão de equipe edita cargos" on public.roles
  for update to authenticated
  using (app.has_permission(establishment_id, 'members.manage'))
  with check (app.has_permission(establishment_id, 'members.manage'));

create policy "gestão de equipe apaga cargos" on public.roles
  for delete to authenticated
  using (app.has_permission(establishment_id, 'members.manage'));

create policy "membros veem a equipe" on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or app.is_member(establishment_id));

create policy "gestão de equipe edita membros" on public.memberships
  for update to authenticated
  using (app.has_permission(establishment_id, 'members.manage'))
  with check (app.has_permission(establishment_id, 'members.manage'));

create policy "gestão de equipe remove membros" on public.memberships
  for delete to authenticated
  using (app.has_permission(establishment_id, 'members.manage'));

create policy "admin da plataforma vê o próprio registo" on public.platform_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "auditoria do estabelecimento" on public.audit_events
  for select to authenticated
  using (app.has_permission(establishment_id, 'audit.read'));

-- Inserções em establishments e memberships passam só pelas funções abaixo.

-- ---------------------------------------------------------------------------
-- Funções de negócio (RPC)
-- ---------------------------------------------------------------------------

-- Plataforma: cria um estabelecimento com os cargos padrão e o Proprietário.
create function public.create_establishment(
  p_name text,
  p_legal_name text,
  p_cnpj text,
  p_kind text,
  p_owner_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_owner_role uuid;
begin
  if not app.is_platform_admin() then
    raise exception 'Apenas a plataforma pode cadastrar estabelecimentos.' using errcode = '42501';
  end if;

  insert into public.establishments (name, legal_name, cnpj, kind)
  values (trim(p_name), trim(p_legal_name), regexp_replace(p_cnpj, '[^0-9]', '', 'g'), p_kind)
  returning id into v_id;

  insert into public.roles (establishment_id, name, permissions, system_key)
  values (v_id, 'Proprietário', app.all_permissions(), 'owner')
  returning id into v_owner_role;

  insert into public.roles (establishment_id, name, permissions, system_key)
  values (v_id, 'Gerente', array_remove(app.all_permissions(), 'establishment.manage'), 'manager');

  insert into public.memberships (establishment_id, user_id, role_id)
  values (v_id, p_owner_user_id, v_owner_role);

  return v_id;
end;
$$;

-- Cliente ou plataforma: adiciona um utilizador (já existente no Auth) a um estabelecimento.
create function public.add_member(p_establishment_id uuid, p_user_id uuid, p_role_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (app.has_permission(p_establishment_id, 'members.manage') or app.is_platform_admin()) then
    raise exception 'Sem permissão para gerir a equipe.' using errcode = '42501';
  end if;

  insert into public.memberships (establishment_id, user_id, role_id)
  values (p_establishment_id, p_user_id, p_role_id)
  returning id into v_id;

  return v_id;
end;
$$;

-- Plataforma: suspende ou reativa um estabelecimento.
create function public.set_establishment_status(p_establishment_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Apenas a plataforma pode alterar o estado da conta.' using errcode = '42501';
  end if;

  update public.establishments set status = p_status where id = p_establishment_id;
end;
$$;

-- Servidor (service_role): encontra o utilizador de um e-mail, para convites.
create function app.user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1
$$;

revoke execute on function public.create_establishment(text, text, text, text, uuid),
  public.add_member(uuid, uuid, uuid), public.set_establishment_status(uuid, text) from public, anon;
grant execute on function public.create_establishment(text, text, text, text, uuid),
  public.add_member(uuid, uuid, uuid), public.set_establishment_status(uuid, text) to authenticated;

revoke execute on function app.user_id_by_email(text) from public, anon, authenticated;
grant execute on function app.user_id_by_email(text) to service_role;
