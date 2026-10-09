-- Etapa 6 — Manutenção preventiva.
-- Um plano recorrente gera uma ordem de serviço (source = 'preventive') alguns dias antes do
-- vencimento. A data avança pelo calendário do plano (não pela data de conclusão), e não se
-- cria uma nova ordem enquanto a anterior do mesmo plano estiver aberta.

create table public.preventive_plans (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 120),
  description text check (length(description) <= 2000),
  location_id uuid not null,
  asset_id uuid,
  category_id uuid,
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  assignee_id uuid references public.profiles (id),
  interval_unit text not null check (interval_unit in ('day', 'week', 'month')),
  interval_count int not null check (interval_count between 1 and 365),
  next_due_on date not null,
  lead_days int not null default 7 check (lead_days between 0 and 60),
  active boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, id),
  foreign key (establishment_id, location_id) references public.locations (establishment_id, id),
  foreign key (establishment_id, asset_id) references public.assets (establishment_id, id),
  foreign key (establishment_id, category_id) references public.categories (establishment_id, id)
);
create index preventive_plans_due_idx on public.preventive_plans (establishment_id, active, next_due_on);
create index preventive_plans_location_idx on public.preventive_plans (establishment_id, location_id);
create index preventive_plans_asset_idx on public.preventive_plans (establishment_id, asset_id);
create index preventive_plans_category_idx on public.preventive_plans (establishment_id, category_id);
create index preventive_plans_assignee_idx on public.preventive_plans (assignee_id);

-- Ordens preventivas não têm "quem abriu": nascem do plano.
alter table public.work_orders add column preventive_plan_id uuid;
alter table public.work_orders
  add constraint work_orders_preventive_plan_fkey
  foreign key (establishment_id, preventive_plan_id) references public.preventive_plans (establishment_id, id) on delete set null (preventive_plan_id);
alter table public.work_orders alter column reported_by drop not null;
alter table public.work_orders add constraint work_orders_reporter_check
  check (reported_by is not null or source = 'preventive');
create index work_orders_preventive_idx on public.work_orders (establishment_id, preventive_plan_id) where preventive_plan_id is not null;

-- ---------------------------------------------------------------------------
-- Regras, auditoria, RLS
-- ---------------------------------------------------------------------------
create function app.guard_preventive_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform app.assert_assignable(new.establishment_id, new.assignee_id);
  end if;
  return new;
end;
$$;

create trigger guard before insert or update on public.preventive_plans
  for each row execute function app.guard_preventive_plan();
create trigger touch before update on public.preventive_plans for each row execute function app.touch_updated_at();
create trigger audit after insert or update or delete on public.preventive_plans for each row execute function app.audit_row();

alter table public.preventive_plans enable row level security;

create policy "membros veem planos preventivos" on public.preventive_plans
  for select to authenticated using (app.is_member(establishment_id));
create policy "gestão de preventivas" on public.preventive_plans
  for all to authenticated
  using (app.has_permission(establishment_id, 'preventive.manage'))
  with check (app.has_permission(establishment_id, 'preventive.manage'));

-- ---------------------------------------------------------------------------
-- Geração das ordens
-- ---------------------------------------------------------------------------
create function app.next_occurrence(p_date date, p_unit text, p_count int)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_date + case p_unit
    when 'day' then make_interval(days => p_count)
    when 'week' then make_interval(weeks => p_count)
    else make_interval(months => p_count)
  end)::date
$$;

-- Gera as ordens que já entraram na janela de antecedência. p_establishment_id null = todos.
-- Devolve quantas ordens foram criadas.
create function app.generate_preventive_work_orders(p_establishment_id uuid default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  v_number int;
  v_assignee uuid;
  v_created int := 0;
begin
  perform set_config('app.actor_type', 'system', true);

  for p in
    select pp.*, e.timezone
    from public.preventive_plans pp
    join public.establishments e on e.id = pp.establishment_id
    where pp.active
      and e.status = 'active'
      and (p_establishment_id is null or pp.establishment_id = p_establishment_id)
      and pp.next_due_on - pp.lead_days <= (now() at time zone e.timezone)::date
      and not exists (
        select 1 from public.work_orders w
        where w.preventive_plan_id = pp.id and w.status in ('pending', 'assigned', 'in_progress', 'on_hold')
      )
    order by pp.next_due_on
    for update of pp skip locked
  loop
    -- Responsável que entretanto saiu ou perdeu a permissão: a ordem nasce sem responsável.
    v_assignee := case when p.assignee_id is not null and exists (
      select 1 from public.memberships m join public.roles r on r.id = m.role_id
      where m.establishment_id = p.establishment_id and m.user_id = p.assignee_id and m.status = 'active'
        and 'work_orders.execute' = any (r.permissions)
    ) then p.assignee_id end;

    update public.establishments set work_order_seq = work_order_seq + 1
    where id = p.establishment_id returning work_order_seq into v_number;

    insert into public.work_orders (
      establishment_id, number, title, description, location_id, asset_id, category_id, priority, status,
      source, preventive_plan_id, reported_by, assignee_id, due_at
    ) values (
      p.establishment_id, v_number, p.title, p.description, p.location_id, p.asset_id, p.category_id, p.priority,
      case when v_assignee is null then 'pending' else 'assigned' end,
      'preventive', p.id, null, v_assignee,
      ((p.next_due_on + 1)::timestamp at time zone p.timezone) - interval '1 second'
    );

    update public.preventive_plans
    set next_due_on = app.next_occurrence(p.next_due_on, p.interval_unit, p.interval_count),
        last_generated_at = now()
    where id = p.id;

    v_created := v_created + 1;
  end loop;

  perform set_config('app.actor_type', '', true);
  return v_created;
end;
$$;

revoke execute on function app.generate_preventive_work_orders(uuid) from public, anon, authenticated;

-- "Gerar agora" pela gestão, limitado ao próprio estabelecimento.
create function public.run_preventive_generation(p_establishment_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_permission(p_establishment_id, 'preventive.manage') then
    raise exception 'Sem permissão para gerir preventivas.' using errcode = '42501';
  end if;
  return app.generate_preventive_work_orders(p_establishment_id);
end;
$$;

revoke execute on function public.run_preventive_generation(uuid) from public, anon;
grant execute on function public.run_preventive_generation(uuid) to authenticated;

-- Execução diária às 06:00 de Brasília (09:00 UTC).
create extension if not exists pg_cron;
select cron.schedule('preventive-daily', '0 9 * * *', $$select app.generate_preventive_work_orders()$$);
