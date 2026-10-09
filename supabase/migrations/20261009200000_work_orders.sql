-- Etapa 4 — Ocorrências / ordens de serviço (entidade única, decisão do plano 2.2).
-- Escrita só por funções (RPC): numeração, prazo, transições e permissões ficam no banco.

alter table public.establishments add column work_order_seq int not null default 0;

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  number int not null,
  title text not null check (length(trim(title)) between 3 and 120),
  description text check (length(description) <= 4000),
  location_id uuid not null,
  asset_id uuid,
  category_id uuid,
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'in_progress', 'on_hold', 'done', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'preventive')),
  reported_by uuid not null references public.profiles (id),
  assignee_id uuid references public.profiles (id),
  due_at timestamptz,
  opened_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  completion_summary text check (length(completion_summary) <= 4000),
  cancellation_reason text check (length(cancellation_reason) <= 1000),
  hold_reason text check (length(hold_reason) <= 500),
  labor_cost numeric(12, 2) check (labor_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, number),
  unique (establishment_id, id),
  foreign key (establishment_id, location_id) references public.locations (establishment_id, id),
  foreign key (establishment_id, asset_id) references public.assets (establishment_id, id),
  foreign key (establishment_id, category_id) references public.categories (establishment_id, id),
  check (status <> 'done' or (completed_at is not null and length(trim(completion_summary)) > 0)),
  check (status <> 'cancelled' or (cancelled_at is not null and length(trim(cancellation_reason)) > 0))
);

create index work_orders_open_idx on public.work_orders (establishment_id, status, priority, due_at)
  where status not in ('done', 'cancelled');
create index work_orders_assignee_idx on public.work_orders (establishment_id, assignee_id) where assignee_id is not null;
create index work_orders_location_idx on public.work_orders (establishment_id, location_id);
create index work_orders_asset_idx on public.work_orders (establishment_id, asset_id) where asset_id is not null;
create index work_orders_category_idx on public.work_orders (establishment_id, category_id);
create index work_orders_reported_by_idx on public.work_orders (reported_by);
create index work_orders_assignee_fk_idx on public.work_orders (assignee_id);
create index work_orders_opened_idx on public.work_orders (establishment_id, opened_at desc);

create table public.work_order_comments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  work_order_id uuid not null,
  author_id uuid not null references public.profiles (id),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  foreign key (establishment_id, work_order_id) references public.work_orders (establishment_id, id) on delete cascade
);
create index work_order_comments_wo_idx on public.work_order_comments (establishment_id, work_order_id, created_at);
create index work_order_comments_author_idx on public.work_order_comments (author_id);

create table public.work_order_items (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  work_order_id uuid not null,
  description text not null check (length(trim(description)) between 2 and 200),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit_cost numeric(12, 2) check (unit_cost >= 0),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (establishment_id, work_order_id) references public.work_orders (establishment_id, id) on delete cascade
);
create index work_order_items_wo_idx on public.work_order_items (establishment_id, work_order_id);
create index work_order_items_created_by_idx on public.work_order_items (created_by);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  work_order_id uuid not null,
  phase text not null default 'opening' check (phase in ('opening', 'progress', 'completion')),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes int not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (establishment_id, work_order_id) references public.work_orders (establishment_id, id) on delete cascade,
  check (storage_path like establishment_id::text || '/' || work_order_id::text || '/%')
);
create index attachments_wo_idx on public.attachments (establishment_id, work_order_id);
create index attachments_uploaded_by_idx on public.attachments (uploaded_by);

-- ---------------------------------------------------------------------------
-- Autorização
-- ---------------------------------------------------------------------------
create function app.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

create function app.can_view_work_order(p_work_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.work_orders w
    where w.id = p_work_order_id
      and app.is_member(w.establishment_id)
      and (
        app.has_permission(w.establishment_id, 'work_orders.read_all')
        or w.reported_by = (select auth.uid())
        or w.assignee_id = (select auth.uid())
      )
  )
$$;

-- Quem pode anexar fotos: quem abriu, o responsável e a gestão; nunca em OS cancelada.
create function app.can_attach_to_work_order(p_work_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.work_orders w
    where w.id = p_work_order_id
      and w.status <> 'cancelled'
      and app.can_view_work_order(w.id)
      and (
        w.reported_by = (select auth.uid())
        or w.assignee_id = (select auth.uid())
        or app.has_permission(w.establishment_id, 'work_orders.manage')
      )
  )
$$;

grant execute on function app.try_uuid(text), app.can_view_work_order(uuid), app.can_attach_to_work_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at, auditoria, RLS
-- ---------------------------------------------------------------------------
create trigger touch before update on public.work_orders for each row execute function app.touch_updated_at();
create trigger audit after insert or update or delete on public.work_orders for each row execute function app.audit_row();
create trigger audit after insert or update or delete on public.work_order_items for each row execute function app.audit_row();
create trigger audit after insert or update or delete on public.attachments for each row execute function app.audit_row();

alter table public.work_orders enable row level security;
alter table public.work_order_comments enable row level security;
alter table public.work_order_items enable row level security;
alter table public.attachments enable row level security;

create policy "ver ocorrências permitidas" on public.work_orders
  for select to authenticated using (app.can_view_work_order(id));

create policy "ver comentários de ocorrências visíveis" on public.work_order_comments
  for select to authenticated using (app.can_view_work_order(work_order_id));
create policy "comentar em ocorrências visíveis" on public.work_order_comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and app.can_view_work_order(work_order_id));

-- Materiais e custos: leitura e escrita só por funções (custos ocultos sem costs.read).

create policy "ver anexos de ocorrências visíveis" on public.attachments
  for select to authenticated using (app.can_view_work_order(work_order_id));
create policy "anexar em ocorrências permitidas" on public.attachments
  for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and app.can_attach_to_work_order(work_order_id));

-- ---------------------------------------------------------------------------
-- Armazenamento privado das fotos: {establishment_id}/{work_order_id}/{arquivo}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('work-orders', 'work-orders', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create function app.work_order_object_ok(p_name text, p_for_write boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.work_orders w
    where w.id = app.try_uuid(split_part(p_name, '/', 2))
      and w.establishment_id = app.try_uuid(split_part(p_name, '/', 1))
      and case when p_for_write then app.can_attach_to_work_order(w.id) else app.can_view_work_order(w.id) end
  )
$$;
grant execute on function app.work_order_object_ok(text, boolean) to authenticated;

create policy "ler fotos de ocorrências visíveis" on storage.objects
  for select to authenticated
  using (bucket_id = 'work-orders' and app.work_order_object_ok(name, false));
create policy "enviar fotos para ocorrências permitidas" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'work-orders' and app.work_order_object_ok(name, true));

-- ---------------------------------------------------------------------------
-- Funções de negócio
-- ---------------------------------------------------------------------------

-- O responsável tem de ser membro ativo com permissão de executar.
create function app.assert_assignable(p_establishment_id uuid, p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then return; end if;
  if not exists (
    select 1 from public.memberships m join public.roles r on r.id = m.role_id
    where m.establishment_id = p_establishment_id and m.user_id = p_user_id and m.status = 'active'
      and 'work_orders.execute' = any (r.permissions)
  ) then
    raise exception 'Essa pessoa não pode receber serviços neste estabelecimento.' using errcode = '23514';
  end if;
end;
$$;

create function public.create_work_order(
  p_establishment_id uuid,
  p_title text,
  p_description text,
  p_location_id uuid,
  p_asset_id uuid,
  p_category_id uuid,
  p_priority text,
  p_assignee_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number int;
  v_hours numeric;
  v_id uuid;
begin
  if not app.has_permission(p_establishment_id, 'work_orders.create') then
    raise exception 'Sem permissão para abrir ocorrências.' using errcode = '42501';
  end if;
  if p_assignee_id is not null and not app.has_permission(p_establishment_id, 'work_orders.assign') then
    raise exception 'Sem permissão para atribuir serviços.' using errcode = '42501';
  end if;
  perform app.assert_assignable(p_establishment_id, p_assignee_id);

  update public.establishments
  set work_order_seq = work_order_seq + 1
  where id = p_establishment_id
  returning work_order_seq, (sla_hours ->> p_priority)::numeric into v_number, v_hours;

  insert into public.work_orders (
    establishment_id, number, title, description, location_id, asset_id, category_id,
    priority, status, reported_by, assignee_id, due_at
  ) values (
    p_establishment_id, v_number, trim(p_title), nullif(trim(p_description), ''), p_location_id, p_asset_id,
    p_category_id, p_priority, case when p_assignee_id is null then 'pending' else 'assigned' end,
    (select auth.uid()), p_assignee_id,
    case when v_hours is null then null else now() + make_interval(secs => v_hours * 3600) end
  ) returning id into v_id;

  return v_id;
end;
$$;

create function public.assign_work_order(p_work_order_id uuid, p_assignee_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.work_orders;
begin
  select * into w from public.work_orders where id = p_work_order_id for update;
  if not found or not app.can_view_work_order(w.id) then
    raise exception 'Ocorrência não encontrada.' using errcode = 'P0002';
  end if;
  if not app.has_permission(w.establishment_id, 'work_orders.assign') then
    raise exception 'Sem permissão para atribuir serviços.' using errcode = '42501';
  end if;
  if w.status in ('done', 'cancelled') then
    raise exception 'A ocorrência já foi encerrada.' using errcode = '23514';
  end if;
  perform app.assert_assignable(w.establishment_id, p_assignee_id);

  update public.work_orders
  set assignee_id = p_assignee_id,
      status = case
        when status in ('pending', 'assigned') then case when p_assignee_id is null then 'pending' else 'assigned' end
        else status
      end
  where id = w.id;
end;
$$;

-- Máquina de estados. A mesma tabela existe em src/lib/domain/work-orders.ts.
create function public.transition_work_order(
  p_work_order_id uuid,
  p_to text,
  p_note text default null,
  p_labor_cost numeric default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.work_orders;
  v_me uuid := (select auth.uid());
  v_manage boolean;
  v_execute boolean;
  v_allowed text[];
  v_note text := nullif(trim(p_note), '');
begin
  select * into w from public.work_orders where id = p_work_order_id for update;
  if not found or not app.can_view_work_order(w.id) then
    raise exception 'Ocorrência não encontrada.' using errcode = 'P0002';
  end if;

  v_manage := app.has_permission(w.establishment_id, 'work_orders.manage');
  v_execute := app.has_permission(w.establishment_id, 'work_orders.execute');

  v_allowed := case w.status
    when 'pending' then array['in_progress', 'cancelled']
    when 'assigned' then array['in_progress', 'cancelled']
    when 'in_progress' then array['on_hold', 'done', 'cancelled']
    when 'on_hold' then array['in_progress', 'cancelled']
    else array[]::text[]
  end;
  if not (p_to = any (v_allowed)) then
    raise exception 'Mudança de estado não permitida.' using errcode = '23514';
  end if;

  if p_to = 'cancelled' then
    if not v_manage then
      raise exception 'Sem permissão para cancelar.' using errcode = '42501';
    end if;
    if v_note is null then
      raise exception 'Informe o motivo do cancelamento.' using errcode = '23514';
    end if;
  elsif not (v_manage or (v_execute and (w.assignee_id = v_me or (w.assignee_id is null and p_to = 'in_progress')))) then
    raise exception 'Só o responsável ou a gestão podem mudar esta ocorrência.' using errcode = '42501';
  end if;

  if p_to = 'done' and v_note is null then
    raise exception 'Descreva o serviço executado.' using errcode = '23514';
  end if;
  if p_labor_cost is not null and not app.has_permission(w.establishment_id, 'costs.write') then
    raise exception 'Sem permissão para registrar custos.' using errcode = '42501';
  end if;

  update public.work_orders
  set status = p_to,
      -- Quem inicia uma ocorrência sem responsável assume-a.
      assignee_id = case when p_to = 'in_progress' and assignee_id is null then v_me else assignee_id end,
      started_at = case when p_to = 'in_progress' then coalesce(started_at, now()) else started_at end,
      hold_reason = case when p_to = 'on_hold' then v_note when p_to = 'in_progress' then null else hold_reason end,
      completed_at = case when p_to = 'done' then now() else completed_at end,
      completion_summary = case when p_to = 'done' then v_note else completion_summary end,
      cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end,
      cancellation_reason = case when p_to = 'cancelled' then v_note else cancellation_reason end,
      labor_cost = coalesce(p_labor_cost, labor_cost)
  where id = w.id;

  if p_to = 'in_progress' and w.assignee_id is null then
    perform app.assert_assignable(w.establishment_id, v_me);
  end if;
end;
$$;

-- Edição de dados: gestão sempre; quem abriu, enquanto ninguém começou.
create function public.update_work_order(
  p_work_order_id uuid,
  p_title text,
  p_description text,
  p_location_id uuid,
  p_asset_id uuid,
  p_category_id uuid,
  p_priority text,
  p_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.work_orders;
  v_manage boolean;
begin
  select * into w from public.work_orders where id = p_work_order_id for update;
  if not found or not app.can_view_work_order(w.id) then
    raise exception 'Ocorrência não encontrada.' using errcode = 'P0002';
  end if;
  v_manage := app.has_permission(w.establishment_id, 'work_orders.manage');
  if not (v_manage or (w.reported_by = (select auth.uid()) and w.status in ('pending', 'assigned'))) then
    raise exception 'Sem permissão para editar esta ocorrência.' using errcode = '42501';
  end if;
  if w.status in ('done', 'cancelled') then
    raise exception 'A ocorrência já foi encerrada.' using errcode = '23514';
  end if;

  update public.work_orders
  set title = trim(p_title),
      description = nullif(trim(p_description), ''),
      location_id = p_location_id,
      asset_id = p_asset_id,
      category_id = p_category_id,
      priority = p_priority,
      due_at = case when v_manage then p_due_at else due_at end
  where id = w.id;
end;
$$;

create function public.add_work_order_item(p_work_order_id uuid, p_description text, p_quantity numeric, p_unit_cost numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.work_orders;
  v_id uuid;
begin
  select * into w from public.work_orders where id = p_work_order_id;
  if not found or not app.can_view_work_order(w.id) then
    raise exception 'Ocorrência não encontrada.' using errcode = 'P0002';
  end if;
  if not (app.has_permission(w.establishment_id, 'work_orders.manage') or w.assignee_id = (select auth.uid())) then
    raise exception 'Só o responsável ou a gestão registram materiais.' using errcode = '42501';
  end if;
  if p_unit_cost is not null and not app.has_permission(w.establishment_id, 'costs.write') then
    raise exception 'Sem permissão para registrar custos.' using errcode = '42501';
  end if;
  if w.status = 'cancelled' then
    raise exception 'A ocorrência foi cancelada.' using errcode = '23514';
  end if;

  insert into public.work_order_items (establishment_id, work_order_id, description, quantity, unit_cost, created_by)
  values (w.establishment_id, w.id, trim(p_description), p_quantity, p_unit_cost, (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.remove_work_order_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.work_order_items;
begin
  select * into i from public.work_order_items where id = p_item_id;
  if not found or not app.can_view_work_order(i.work_order_id) then
    raise exception 'Item não encontrado.' using errcode = 'P0002';
  end if;
  if not (app.has_permission(i.establishment_id, 'work_orders.manage') or i.created_by = (select auth.uid())) then
    raise exception 'Sem permissão para remover este item.' using errcode = '42501';
  end if;
  delete from public.work_order_items where id = i.id;
end;
$$;

-- Materiais: o custo só aparece para quem tem costs.read.
create function public.work_order_items_for(p_work_order_id uuid)
returns table (id uuid, description text, quantity numeric, unit_cost numeric, created_by uuid, created_by_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.description, i.quantity,
         case when app.has_permission(i.establishment_id, 'costs.read') then i.unit_cost end,
         i.created_by, p.full_name, i.created_at
  from public.work_order_items i
  join public.profiles p on p.id = i.created_by
  where i.work_order_id = p_work_order_id and app.can_view_work_order(p_work_order_id)
  order by i.created_at
$$;

-- Linha do tempo da ocorrência (a partir da auditoria), visível a quem vê a ocorrência.
create function public.work_order_timeline(p_work_order_id uuid)
returns table (at timestamptz, actor_name text, action text, changed_fields text[], before jsonb, after jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select e.created_at, coalesce(nullif(p.full_name, ''), case e.actor_type when 'system' then 'Sistema' else 'Utilizador' end),
         e.action, e.changed_fields,
         jsonb_strip_nulls(jsonb_build_object(
           'status', e.before -> 'status', 'assignee_id', e.before -> 'assignee_id',
           'priority', e.before -> 'priority', 'due_at', e.before -> 'due_at')),
         jsonb_strip_nulls(jsonb_build_object(
           'status', e.after -> 'status', 'assignee_id', e.after -> 'assignee_id',
           'priority', e.after -> 'priority', 'due_at', e.after -> 'due_at',
           'hold_reason', e.after -> 'hold_reason'))
  from public.audit_events e
  left join public.profiles p on p.id = e.actor_id
  where e.entity_type = 'work_orders' and e.entity_id = p_work_order_id
    and app.can_view_work_order(p_work_order_id)
  order by e.created_at, e.id
$$;

revoke execute on function
  public.create_work_order(uuid, text, text, uuid, uuid, uuid, text, uuid),
  public.assign_work_order(uuid, uuid),
  public.transition_work_order(uuid, text, text, numeric),
  public.update_work_order(uuid, text, text, uuid, uuid, uuid, text, timestamptz),
  public.add_work_order_item(uuid, text, numeric, numeric),
  public.remove_work_order_item(uuid),
  public.work_order_items_for(uuid),
  public.work_order_timeline(uuid)
from public, anon;

grant execute on function
  public.create_work_order(uuid, text, text, uuid, uuid, uuid, text, uuid),
  public.assign_work_order(uuid, uuid),
  public.transition_work_order(uuid, text, text, numeric),
  public.update_work_order(uuid, text, text, uuid, uuid, uuid, text, timestamptz),
  public.add_work_order_item(uuid, text, numeric, numeric),
  public.remove_work_order_item(uuid),
  public.work_order_items_for(uuid),
  public.work_order_timeline(uuid)
to authenticated;

-- O contador de numeração não interessa à auditoria (cada ocorrência nova geraria um evento no estabelecimento).
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
  v_ignored text[] := array['updated_at', 'created_at', 'work_order_seq'];
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
