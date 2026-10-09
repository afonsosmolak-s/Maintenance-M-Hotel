-- Teste da etapa 5: números do painel conferidos com dados montados à mão.
-- Termina com uma exceção para desfazer tudo. Esperado: "DASHBOARD_TESTS_PASSED (n verificações)".
do $tests$
declare
  u_platform uuid := gen_random_uuid();
  u_owner uuid := gen_random_uuid();
  u_other uuid := gen_random_uuid();
  u_tech uuid := gen_random_uuid();
  est uuid;
  est_other uuid;
  role_tech uuid;
  bloco_a uuid;
  bloco_b uuid;
  suite uuid;
  cat uuid;
  asset uuid;
  m jsonb;
  n int;
  checks int := 0;
  failed boolean;
  t0 timestamptz := date_trunc('day', now()) - interval '10 days';
begin
  insert into auth.users (id, email, aud, role) values
    (u_platform, 'p@test.local', 'authenticated', 'authenticated'),
    (u_owner, 'o@test.local', 'authenticated', 'authenticated'),
    (u_other, 'x@test.local', 'authenticated', 'authenticated'),
    (u_tech, 't@test.local', 'authenticated', 'authenticated');
  insert into public.platform_admins values (u_platform);

  perform set_config('request.jwt.claims', json_build_object('sub', u_platform, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
  est := public.create_establishment('Motel D', 'Motel D Ltda', '11222333000181', 'motel', u_owner);
  est_other := public.create_establishment('Hotel X', 'Hotel X SA', '45723174000110', 'hotel', u_other);
  reset role;

  -- Estrutura e equipe (direto, como superutilizador do teste).
  insert into public.locations (establishment_id, name) values (est, 'Bloco A') returning id into bloco_a;
  insert into public.locations (establishment_id, name) values (est, 'Bloco B') returning id into bloco_b;
  insert into public.locations (establishment_id, parent_id, name) values (est, bloco_a, 'Suíte 1') returning id into suite;
  insert into public.categories (establishment_id, name) values (est, 'Hidráulica') returning id into cat;
  insert into public.assets (establishment_id, location_id, name) values (est, suite, 'Banheira') returning id into asset;
  insert into public.roles (establishment_id, name, permissions)
  values (est, 'Técnico', array['work_orders.create', 'work_orders.read_all', 'work_orders.execute']) returning id into role_tech;
  insert into public.memberships (establishment_id, user_id, role_id) values (est, u_tech, role_tech);

  -- Ocorrências com datas controladas.
  -- 1) aberta, crítica, atrasada, sem responsável, Bloco A (suíte), banheira
  insert into public.work_orders (establishment_id, number, title, location_id, asset_id, category_id, priority, status, reported_by, opened_at, due_at)
  values (est, 1, 'Vazamento 1', suite, asset, cat, 'critical', 'pending', u_owner, t0 + interval '1 day', now() - interval '1 hour');
  -- 2) em andamento, alta, técnico, Bloco B, no prazo
  insert into public.work_orders (establishment_id, number, title, location_id, priority, status, reported_by, assignee_id, opened_at, started_at, due_at)
  values (est, 2, 'Lâmpada', bloco_b, 'high', 'in_progress', u_owner, u_tech, t0 + interval '2 days', t0 + interval '2 days', now() + interval '5 hours');
  -- 3) concluída em 10 h, no prazo, técnico, Bloco A, banheira, custo 50 + 30
  insert into public.work_orders (establishment_id, number, title, location_id, asset_id, category_id, priority, status, reported_by, assignee_id,
    opened_at, started_at, completed_at, completion_summary, due_at, labor_cost)
  values (est, 3, 'Vazamento 2', suite, asset, cat, 'medium', 'done', u_owner, u_tech,
    t0 + interval '3 days', t0 + interval '3 days', t0 + interval '3 days 10 hours', 'ok', t0 + interval '6 days', 30);
  insert into public.work_order_items (establishment_id, work_order_id, description, quantity, unit_cost, created_by)
  select est, id, 'Vedação', 2, 25, u_tech from public.work_orders where establishment_id = est and number = 3;
  -- 4) concluída em 30 h, ATRASADA na conclusão, técnico, Bloco B
  insert into public.work_orders (establishment_id, number, title, location_id, priority, status, reported_by, assignee_id,
    opened_at, started_at, completed_at, completion_summary, due_at)
  values (est, 4, 'Ar-condicionado', bloco_b, 'high', 'done', u_owner, u_tech,
    t0 + interval '4 days', t0 + interval '4 days', t0 + interval '5 days 6 hours', 'ok', t0 + interval '5 days');
  -- 5) cancelada no período
  insert into public.work_orders (establishment_id, number, title, location_id, priority, status, reported_by,
    opened_at, cancelled_at, cancellation_reason)
  values (est, 5, 'Duplicada', bloco_a, 'low', 'cancelled', u_owner, t0 + interval '5 days', t0 + interval '5 days 1 hour', 'duplicada');
  -- 6) concluída FORA do período (antes de t0)
  insert into public.work_orders (establishment_id, number, title, location_id, priority, status, reported_by,
    opened_at, completed_at, completion_summary)
  values (est, 6, 'Antiga', bloco_a, 'low', 'done', u_owner, t0 - interval '20 days', t0 - interval '19 days', 'ok');

  -- ------------------------------------------------------------- dono
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  m := public.dashboard_metrics(est, t0, now() + interval '1 day');

  if (m -> 'now' ->> 'open')::int <> 2 then raise exception 'abertas: esperado 2, veio %', m -> 'now' ->> 'open'; end if;
  if (m -> 'now' ->> 'critical')::int <> 1 then raise exception 'críticas: esperado 1'; end if;
  if (m -> 'now' ->> 'overdue')::int <> 1 then raise exception 'atrasadas: esperado 1'; end if;
  if (m -> 'now' ->> 'unassigned')::int <> 1 then raise exception 'sem responsável: esperado 1'; end if;
  if (m -> 'now' ->> 'in_progress')::int <> 1 then raise exception 'em andamento: esperado 1'; end if;
  checks := checks + 1;

  if (m -> 'period' ->> 'opened')::int <> 5 then raise exception 'abertas no período: esperado 5, veio %', m -> 'period' ->> 'opened'; end if;
  if (m -> 'period' ->> 'completed')::int <> 2 then raise exception 'concluídas no período: esperado 2'; end if;
  if (m -> 'period' ->> 'cancelled')::int <> 1 then raise exception 'canceladas no período: esperado 1'; end if;
  checks := checks + 1;

  if (m -> 'period' ->> 'resolution_avg_hours')::numeric <> 20.0 then
    raise exception 'tempo médio: esperado 20.0 h, veio %', m -> 'period' ->> 'resolution_avg_hours';
  end if;
  if (m -> 'period' ->> 'on_time')::int <> 1 or (m -> 'period' ->> 'with_due')::int <> 2 then
    raise exception 'no prazo: esperado 1 de 2';
  end if;
  checks := checks + 1;

  if (m -> 'period' ->> 'cost_total')::numeric <> 80 then
    raise exception 'custo: esperado 80, veio %', m -> 'period' ->> 'cost_total';
  end if;
  checks := checks + 1;

  select count(*) into n from jsonb_array_elements(m -> 'by_sector') s
  where (s ->> 'name' = 'Bloco A' and (s ->> 'open')::int = 1 and (s ->> 'overdue')::int = 1 and (s ->> 'completed')::int = 1)
     or (s ->> 'name' = 'Bloco B' and (s ->> 'open')::int = 1 and (s ->> 'completed')::int = 1);
  if n <> 2 then raise exception 'por setor incorreto: %', m -> 'by_sector'; end if;
  checks := checks + 1;

  select count(*) into n from jsonb_array_elements(m -> 'by_assignee') a
  where a ->> 'id' = u_tech::text and (a ->> 'open')::int = 1 and (a ->> 'completed')::int = 2 and (a ->> 'avg_hours')::numeric = 20.0;
  if n <> 1 then raise exception 'por responsável incorreto: %', m -> 'by_assignee'; end if;
  checks := checks + 1;

  select count(*) into n from jsonb_array_elements(m -> 'recurring_assets') r where (r ->> 'count')::int = 2;
  if n <> 1 then raise exception 'equipamento recorrente não detectado: %', m -> 'recurring_assets'; end if;
  checks := checks + 1;

  -- Filtro por setor.
  m := public.dashboard_metrics(est, t0, now() + interval '1 day', bloco_b);
  if (m -> 'now' ->> 'open')::int <> 1 or (m -> 'period' ->> 'completed')::int <> 1 then
    raise exception 'filtro por setor incorreto: %', m;
  end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.dashboard_metrics(est, now(), now() - interval '1 day');
  exception when invalid_parameter_value then failed := true;
  end;
  if not failed then raise exception 'aceitou período invertido'; end if;
  checks := checks + 1;
  reset role;

  -- ----------------------------------------------- sem permissão / outro cliente
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  set local role authenticated;
  failed := false;
  begin
    perform public.dashboard_metrics(est, t0, now());
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico sem dashboard.read abriu o painel'; end if;
  checks := checks + 1;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  failed := false;
  begin
    perform public.dashboard_metrics(est, t0, now());
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'outro cliente abriu o painel'; end if;
  checks := checks + 1;
  reset role;

  raise exception 'DASHBOARD_TESTS_PASSED (% verificações)', checks;
end
$tests$;
