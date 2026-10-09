-- A origem da ação na auditoria passa a ser declarada por quem age (função da plataforma),
-- em vez de deduzida. Antes, um admin da plataforma que fosse também o Proprietário criado
-- aparecia como 'user' no evento da própria membership.

create or replace function app.audit_row()
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
  v_declared text := nullif(current_setting('app.actor_type', true), '');
  v_actor_type text;
begin
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into v_changed
    from jsonb_each(v_new) n
    where not (key = any (v_ignored))
      and n.value is distinct from v_old -> key;
    if v_changed is null then
      return null;
    end if;
  end if;

  v_establishment_id := case
    when tg_table_name = 'establishments' then (v_row ->> 'id')::uuid
    else (v_row ->> 'establishment_id')::uuid
  end;

  v_actor_type := case
    when v_declared in ('platform', 'system', 'device') then v_declared
    when v_actor is null then 'system'
    else 'user'
  end;

  insert into public.audit_events
    (establishment_id, actor_type, actor_id, action, entity_type, entity_id, before, after, changed_fields)
  values (
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

create or replace function public.create_establishment(
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
  perform set_config('app.actor_type', 'platform', true);

  insert into public.establishments (name, legal_name, cnpj, kind)
  values (trim(p_name), trim(p_legal_name), regexp_replace(upper(p_cnpj), '[^0-9A-Z]', '', 'g'), p_kind)
  returning id into v_id;

  insert into public.roles (establishment_id, name, permissions, system_key)
  values (v_id, 'Proprietário', app.all_permissions(), 'owner')
  returning id into v_owner_role;

  insert into public.roles (establishment_id, name, permissions, system_key)
  values (v_id, 'Gerente', array_remove(app.all_permissions(), 'establishment.manage'), 'manager');

  insert into public.memberships (establishment_id, user_id, role_id)
  values (v_id, p_owner_user_id, v_owner_role);

  perform set_config('app.actor_type', '', true);
  return v_id;
end;
$$;

create or replace function public.set_establishment_status(p_establishment_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_platform_admin() then
    raise exception 'Apenas a plataforma pode alterar o estado da conta.' using errcode = '42501';
  end if;
  perform set_config('app.actor_type', 'platform', true);

  update public.establishments set status = p_status where id = p_establishment_id;

  perform set_config('app.actor_type', '', true);
end;
$$;
