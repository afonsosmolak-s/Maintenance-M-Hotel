-- Etapa 5 — Painel de gestão. Indicadores calculados no banco a partir de dados reais.
-- "Agora" (abertas, atrasadas, por setor…) ignora o período; "No período" usa [p_from, p_to).

create function public.dashboard_metrics(
  p_establishment_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_sector_id uuid default null,
  p_priority text default null,
  p_assignee_id uuid default null,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_costs boolean;
  v_result jsonb;
begin
  if not app.has_permission(p_establishment_id, 'dashboard.read') then
    raise exception 'Sem permissão para o painel de gestão.' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  v_costs := app.has_permission(p_establishment_id, 'costs.read');

  with base as (
    select w.*, l.sector_id
    from public.work_orders w
    join public.locations l on l.id = w.location_id
    where w.establishment_id = p_establishment_id
      and (p_sector_id is null or l.sector_id = p_sector_id)
      and (p_priority is null or w.priority = p_priority)
      and (p_assignee_id is null or w.assignee_id = p_assignee_id)
  ),
  open_now as (
    select *, (due_at is not null and due_at < now()) as overdue
    from base
    where status in ('pending', 'assigned', 'in_progress', 'on_hold')
      and (p_status is null or status = p_status)
  ),
  completed as (
    select *, extract(epoch from (completed_at - opened_at)) / 3600.0 as hours
    from base
    where status = 'done' and completed_at >= p_from and completed_at < p_to
  ),
  opened as (
    select * from base where opened_at >= p_from and opened_at < p_to
  ),
  item_costs as (
    select i.work_order_id, sum(coalesce(i.unit_cost, 0) * i.quantity) as materials
    from public.work_order_items i
    where i.establishment_id = p_establishment_id
    group by i.work_order_id
  )
  select jsonb_build_object(
    'now', jsonb_build_object(
      'open', (select count(*) from open_now),
      'critical', (select count(*) from open_now where priority = 'critical'),
      'high', (select count(*) from open_now where priority = 'high'),
      'medium', (select count(*) from open_now where priority = 'medium'),
      'low', (select count(*) from open_now where priority = 'low'),
      'pending', (select count(*) from open_now where status = 'pending'),
      'assigned', (select count(*) from open_now where status = 'assigned'),
      'in_progress', (select count(*) from open_now where status = 'in_progress'),
      'on_hold', (select count(*) from open_now where status = 'on_hold'),
      'overdue', (select count(*) from open_now where overdue),
      'unassigned', (select count(*) from open_now where assignee_id is null)
    ),
    'period', jsonb_build_object(
      'opened', (select count(*) from opened),
      'completed', (select count(*) from completed),
      'cancelled', (select count(*) from base where status = 'cancelled' and cancelled_at >= p_from and cancelled_at < p_to),
      'resolution_sample', (select count(*) from completed),
      'resolution_avg_hours', (select round(avg(hours)::numeric, 1) from completed),
      'resolution_median_hours', (select round((percentile_cont(0.5) within group (order by hours))::numeric, 1) from completed),
      'on_time', (select count(*) from completed where due_at is not null and completed_at <= due_at),
      'with_due', (select count(*) from completed where due_at is not null),
      'cost_total', case when v_costs then (
        select round(coalesce(sum(coalesce(c.labor_cost, 0) + coalesce(ic.materials, 0)), 0)::numeric, 2)
        from completed c left join item_costs ic on ic.work_order_id = c.id
      ) end,
      'preventive_completed', (select count(*) from completed where source = 'preventive')
    ),
    'by_sector', coalesce((
      select jsonb_agg(s order by s.open desc, s.completed desc, s.name)
      from (
        select l.id, l.name,
          (select count(*) from open_now o where o.sector_id = l.id) as open,
          (select count(*) from open_now o where o.sector_id = l.id and o.overdue) as overdue,
          (select count(*) from completed c where c.sector_id = l.id) as completed
        from public.locations l
        where l.establishment_id = p_establishment_id and l.parent_id is null
          and (p_sector_id is null or l.id = p_sector_id)
      ) s
      where s.open > 0 or s.completed > 0
    ), '[]'::jsonb),
    'by_assignee', coalesce((
      select jsonb_agg(a order by a.open desc, a.completed desc, a.name)
      from (
        select p.id, coalesce(nullif(p.full_name, ''), p.email) as name,
          (select count(*) from open_now o where o.assignee_id = p.id) as open,
          (select count(*) from open_now o where o.assignee_id = p.id and o.status = 'in_progress') as in_progress,
          (select count(*) from open_now o where o.assignee_id = p.id and o.overdue) as overdue,
          (select count(*) from completed c where c.assignee_id = p.id) as completed,
          (select round(avg(c.hours)::numeric, 1) from completed c where c.assignee_id = p.id) as avg_hours
        from public.profiles p
        where p.id in (select assignee_id from open_now union select assignee_id from completed)
      ) a
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(c order by c.opened desc, c.open desc, c.name)
      from (
        select raw.name, sum(raw.open)::int as open, sum(raw.opened)::int as opened
        from (
          select coalesce(cat.name, 'Sem categoria') as name, 1 as open, 0 as opened
          from open_now o left join public.categories cat on cat.id = o.category_id
          union all
          select coalesce(cat.name, 'Sem categoria'), 0, 1
          from opened op left join public.categories cat on cat.id = op.category_id
        ) raw
        group by raw.name
      ) c
    ), '[]'::jsonb),
    'recurring_assets', coalesce((
      select jsonb_agg(r order by r.count desc, r.name)
      from (
        select a.id, a.name, a.location_id, count(*) as count
        from opened op
        join public.assets a on a.id = op.asset_id
        group by a.id, a.name, a.location_id
        having count(*) >= 2
        order by count(*) desc
        limit 5
      ) r
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.dashboard_metrics(uuid, timestamptz, timestamptz, uuid, text, uuid, text) from public, anon;
grant execute on function public.dashboard_metrics(uuid, timestamptz, timestamptz, uuid, text, uuid, text) to authenticated;
