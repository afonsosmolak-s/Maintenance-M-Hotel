-- Teste da etapa 6: manutenção preventiva.
-- Termina com uma exceção para desfazer tudo. Esperado: "PREVENTIVE_TESTS_PASSED (n verificações)".
do $tests$
declare
  u_platform uuid := gen_random_uuid();
  u_owner uuid := gen_random_uuid();
  u_other uuid := gen_random_uuid();
  u_tech uuid := gen_random_uuid();
  est uuid;
  est_other uuid;
  role_tech uuid;
  loc uuid;
  plan1 uuid;
  plan2 uuid;
  plan3 uuid;
  wo public.work_orders;
  n int;
  d date;
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  checks int := 0;
  failed boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (u_platform, 'p@test.local', 'authenticated', 'authenticated'),
    (u_owner, 'o@test.local', 'authenticated', 'authenticated'),
    (u_other, 'x@test.local', 'authenticated', 'authenticated'),
    (u_tech, 't@test.local', 'authenticated', 'authenticated');
  insert into public.platform_admins values (u_platform);

  perform set_config('request.jwt.claims', json_build_object('sub', u_platform, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
  est := public.create_establishment('Motel P', 'Motel P Ltda', '11222333000181', 'motel', u_owner);
  est_other := public.create_establishment('Hotel X', 'Hotel X SA', '45723174000110', 'hotel', u_other);
  reset role;

  -- Calendário: fim de mês.
  if app.next_occurrence('2026-01-31', 'month', 1) <> '2026-02-28' then raise exception 'mês curto'; end if;
  if app.next_occurrence('2026-10-09', 'week', 2) <> '2026-10-23' then raise exception 'semanas'; end if;
  checks := checks + 1;

  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.locations (establishment_id, name) values (est, 'Área técnica') returning id into loc;
  insert into public.roles (establishment_id, name, permissions)
  values (est, 'Técnico', array['work_orders.create', 'work_orders.read_all', 'work_orders.execute']) returning id into role_tech;
  perform public.add_member(est, u_tech, role_tech);

  -- Plano 1: vence em 5 dias, antecedência 7 → já deve gerar.
  insert into public.preventive_plans (establishment_id, title, location_id, interval_unit, interval_count, next_due_on, lead_days, assignee_id)
  values (est, 'Limpar filtros do ar', loc, 'month', 3, today + 5, 7, u_tech) returning id into plan1;
  -- Plano 2: vence em 30 dias → ainda não.
  insert into public.preventive_plans (establishment_id, title, location_id, interval_unit, interval_count, next_due_on, lead_days)
  values (est, 'Revisar bombas', loc, 'week', 2, today + 30, 7) returning id into plan2;
  -- Plano 3: inativo e vencido → nunca gera.
  insert into public.preventive_plans (establishment_id, title, location_id, interval_unit, interval_count, next_due_on, lead_days, active)
  values (est, 'Plano desligado', loc, 'day', 1, today - 3, 0, false) returning id into plan3;

  failed := false;
  begin
    insert into public.preventive_plans (establishment_id, title, location_id, interval_unit, interval_count, next_due_on, assignee_id)
    values (est, 'Responsável de fora', loc, 'day', 1, today, u_other);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'plano aceitou responsável de fora'; end if;
  checks := checks + 1;

  n := public.run_preventive_generation(est);
  if n <> 1 then raise exception 'esperava 1 ordem gerada, vieram %', n; end if;
  select * into wo from public.work_orders where preventive_plan_id = plan1;
  if wo.source <> 'preventive' or wo.reported_by is not null or wo.assignee_id <> u_tech or wo.status <> 'assigned' then
    raise exception 'ordem preventiva com dados errados';
  end if;
  if (wo.due_at at time zone 'America/Sao_Paulo')::date <> today + 5 then raise exception 'prazo deveria ser o vencimento do plano'; end if;
  select next_due_on into d from public.preventive_plans where id = plan1;
  if d <> app.next_occurrence(today + 5, 'month', 3) then raise exception 'próximo vencimento não avançou 3 meses'; end if;
  checks := checks + 1;

  if public.run_preventive_generation(est) <> 0 then raise exception 'gerou de novo sem motivo'; end if;
  checks := checks + 1;

  -- Sem acumular: plano 1 volta a vencer hoje, mas a ordem anterior está aberta.
  update public.preventive_plans set next_due_on = today where id = plan1;
  if public.run_preventive_generation(est) <> 0 then raise exception 'acumulou ordens do mesmo plano'; end if;
  checks := checks + 1;
  reset role;

  -- Técnico conclui a anterior → a próxima pode nascer.
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.transition_work_order(wo.id, 'in_progress');
  perform public.transition_work_order(wo.id, 'done', 'Filtros limpos');

  select count(*) into n from public.preventive_plans where establishment_id = est;
  if n <> 3 then raise exception 'técnico deveria ver os planos'; end if;
  failed := false;
  begin
    insert into public.preventive_plans (establishment_id, title, location_id, interval_unit, interval_count, next_due_on)
    values (est, 'Plano do técnico', loc, 'day', 1, today);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico criou plano'; end if;
  failed := false;
  begin
    perform public.run_preventive_generation(est);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico disparou a geração'; end if;
  checks := checks + 1;
  reset role;

  -- Técnico perde a permissão de executar → a próxima nasce sem responsável.
  update public.roles set permissions = array['work_orders.create', 'work_orders.read_all'] where id = role_tech;
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if public.run_preventive_generation(est) <> 1 then raise exception 'deveria gerar a próxima depois de concluída'; end if;
  select * into wo from public.work_orders where preventive_plan_id = plan1 and status <> 'done';
  if wo.assignee_id is not null or wo.status <> 'pending' then raise exception 'deveria nascer sem responsável'; end if;
  checks := checks + 1;
  reset role;

  -- Outro cliente: não vê, não altera, não dispara.
  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.preventive_plans where establishment_id = est;
  if n <> 0 then raise exception 'outro cliente viu planos'; end if;
  update public.preventive_plans set active = false where id = plan2;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'outro cliente desativou plano'; end if;
  failed := false;
  begin
    perform public.run_preventive_generation(est);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'outro cliente disparou a geração'; end if;
  checks := checks + 1;
  reset role;

  -- Conta suspensa não gera; o agendamento diário (todos os estabelecimentos) respeita isso.
  perform set_config('request.jwt.claims', '', true); -- como o agendador: sem utilizador
  update public.preventive_plans set next_due_on = today where id = plan2;
  update public.establishments set status = 'suspended' where id = est;
  if app.generate_preventive_work_orders() <> 0 then raise exception 'gerou para conta suspensa'; end if;
  update public.establishments set status = 'active' where id = est;
  if app.generate_preventive_work_orders(est) <> 1 then raise exception 'deveria gerar o plano 2 com a conta ativa'; end if;
  checks := checks + 1;

  select count(*) into n from public.work_orders where preventive_plan_id = plan3;
  if n <> 0 then raise exception 'plano inativo gerou ordem'; end if;
  select count(*) into n from public.audit_events where entity_type = 'work_orders' and actor_type = 'system' and establishment_id = est;
  if n < 3 then raise exception 'ordens geradas deveriam ficar na auditoria como sistema'; end if;
  checks := checks + 1;

  raise exception 'PREVENTIVE_TESTS_PASSED (% verificações)', checks;
end
$tests$;
