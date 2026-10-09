-- Teste da etapa 4: ocorrências / ordens de serviço.
-- Termina com uma exceção para desfazer tudo. Esperado: "WORK_ORDER_TESTS_PASSED (n verificações)".
do $tests$
declare
  u_platform uuid := gen_random_uuid();
  u_owner_a uuid := gen_random_uuid();
  u_owner_b uuid := gen_random_uuid();
  u_tech1 uuid := gen_random_uuid();
  u_tech2 uuid := gen_random_uuid();
  est_a uuid;
  est_b uuid;
  role_tech uuid;
  loc uuid;
  wo1 uuid;
  wo2 uuid;
  w public.work_orders;
  n int;
  t text;
  num numeric;
  checks int := 0;
  failed boolean;
  audit_before int;
begin
  insert into auth.users (id, email, aud, role) values
    (u_platform, 'p@test.local', 'authenticated', 'authenticated'),
    (u_owner_a, 'a@test.local', 'authenticated', 'authenticated'),
    (u_owner_b, 'b@test.local', 'authenticated', 'authenticated'),
    (u_tech1, 't1@test.local', 'authenticated', 'authenticated'),
    (u_tech2, 't2@test.local', 'authenticated', 'authenticated');
  insert into public.platform_admins values (u_platform);

  perform set_config('request.jwt.claims', json_build_object('sub', u_platform, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
  est_a := public.create_establishment('Motel A', 'Motel A Ltda', '11222333000181', 'motel', u_owner_a);
  est_b := public.create_establishment('Hotel B', 'Hotel B SA', '45723174000110', 'hotel', u_owner_b);
  reset role;

  -- Dono A monta a estrutura mínima e a equipe.
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.locations (establishment_id, name) values (est_a, 'Suíte 1') returning id into loc;
  insert into public.roles (establishment_id, name, permissions)
  values (est_a, 'Técnico', array['work_orders.create', 'work_orders.read_all', 'work_orders.execute'])
  returning id into role_tech;
  perform public.add_member(est_a, u_tech1, role_tech);
  perform public.add_member(est_a, u_tech2, role_tech);
  reset role;

  select count(*) into audit_before from public.audit_events where entity_type = 'establishments' and entity_id = est_a;

  -- ------------------------------------------------------------- técnico 1 abre
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech1, 'role', 'authenticated')::text, true);
  set local role authenticated;

  wo1 := public.create_work_order(est_a, 'Banheira com vazamento', 'Água no piso', loc, null, null, 'high', null);
  select * into w from public.work_orders where id = wo1;
  if w.number <> 1 or w.status <> 'pending' or w.reported_by <> u_tech1 then
    raise exception 'ocorrência criada com dados errados: n=% status=%', w.number, w.status;
  end if;
  if abs(extract(epoch from (w.due_at - w.opened_at)) - 24 * 3600) > 5 then
    raise exception 'prazo deveria ser 24 h (SLA alta)';
  end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.create_work_order(est_a, 'Com responsável', null, loc, null, null, 'low', u_tech2);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico atribuiu ao abrir sem permissão'; end if;
  checks := checks + 1;

  failed := false;
  begin
    update public.work_orders set status = 'done' where id = wo1;
    get diagnostics n = row_count;
    if n = 0 then failed := true; end if;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'alteração direta na tabela foi aceita'; end if;
  checks := checks + 1;
  reset role;

  select count(*) into n from public.audit_events where entity_type = 'establishments' and entity_id = est_a;
  if n <> audit_before then raise exception 'numeração gerou ruído na auditoria do estabelecimento'; end if;
  checks := checks + 1;

  -- -------------------------------------------------------------- dono B (outro cliente)
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner_b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.work_orders where establishment_id = est_a;
  if n <> 0 then raise exception 'dono B viu ocorrências de A'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.transition_work_order(wo1, 'in_progress');
  exception when no_data_found then failed := true;
  end;
  if not failed then raise exception 'dono B mexeu em ocorrência de A'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.create_work_order(est_a, 'Intruso', null, loc, null, null, 'low', null);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'dono B abriu ocorrência em A'; end if;
  checks := checks + 1;

  failed := false;
  begin
    insert into public.work_order_comments (establishment_id, work_order_id, author_id, body) values (est_a, wo1, u_owner_b, 'oi');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'dono B comentou em A'; end if;
  checks := checks + 1;

  if app.work_order_object_ok(est_a::text || '/' || wo1::text || '/x.jpg', false) then
    raise exception 'dono B teria acesso às fotos de A';
  end if;
  checks := checks + 1;

  select count(*) into n from public.work_order_timeline(wo1);
  if n <> 0 then raise exception 'dono B leu a linha do tempo de A'; end if;
  checks := checks + 1;
  reset role;

  -- ---------------------------------------------------------- técnico 2 assume
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech2, 'role', 'authenticated')::text, true);
  set local role authenticated;

  perform public.transition_work_order(wo1, 'in_progress');
  select * into w from public.work_orders where id = wo1;
  if w.assignee_id <> u_tech2 or w.started_at is null then raise exception 'iniciar sem responsável deveria assumir'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.transition_work_order(wo1, 'done', '   ');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'concluiu sem descrever o serviço'; end if;
  checks := checks + 1;

  perform public.transition_work_order(wo1, 'on_hold', 'Vedação encomendada');
  perform public.transition_work_order(wo1, 'in_progress');

  failed := false;
  begin
    perform public.add_work_order_item(wo1, 'Vedação', 1, 45.90);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico registrou custo sem permissão'; end if;
  checks := checks + 1;

  perform public.add_work_order_item(wo1, 'Vedação de silicone', 1, null);
  insert into public.work_order_comments (establishment_id, work_order_id, author_id, body)
  values (est_a, wo1, u_tech2, 'Trocando a vedação');

  failed := false;
  begin
    insert into public.attachments (establishment_id, work_order_id, phase, storage_path, content_type, size_bytes, uploaded_by)
    values (est_a, wo1, 'completion', est_b::text || '/' || wo1::text || '/a.jpg', 'image/jpeg', 100, u_tech2);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'anexo aceitou caminho de outro estabelecimento'; end if;
  checks := checks + 1;

  insert into public.attachments (establishment_id, work_order_id, phase, storage_path, content_type, size_bytes, uploaded_by)
  values (est_a, wo1, 'completion', est_a::text || '/' || wo1::text || '/a.jpg', 'image/jpeg', 100, u_tech2);

  perform public.transition_work_order(wo1, 'done', 'Vedação trocada e testada.');
  select * into w from public.work_orders where id = wo1;
  if w.status <> 'done' or w.completed_at is null then raise exception 'conclusão não registrada'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.transition_work_order(wo1, 'in_progress');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'reabriu uma ocorrência concluída'; end if;
  checks := checks + 1;

  select count(*) into n from public.work_order_timeline(wo1) where after ? 'status';
  if n < 5 then raise exception 'linha do tempo incompleta: % eventos de estado', n; end if;
  checks := checks + 1;
  reset role;

  -- --------------------------------------------- técnico 1 não mexe no que não é seu
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  wo2 := public.create_work_order(est_a, 'Lâmpada queimada', null, loc, null, null, 'low', null);
  select number into n from public.work_orders where id = wo2;
  if n <> 2 then raise exception 'numeração deveria ser 2, foi %', n; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.transition_work_order(wo2, 'cancelled', 'não quero');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico cancelou'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.assign_work_order(wo2, u_tech2);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico atribuiu sem permissão'; end if;
  checks := checks + 1;
  reset role;

  -- ------------------------------------------------------------- dono A gere
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  perform public.assign_work_order(wo2, u_tech2);
  select status into t from public.work_orders where id = wo2;
  if t <> 'assigned' then raise exception 'atribuir deveria mudar para Atribuída'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.assign_work_order(wo2, u_owner_b);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'atribuiu a alguém de fora'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.transition_work_order(wo2, 'cancelled', '');
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'cancelou sem motivo'; end if;
  perform public.transition_work_order(wo2, 'cancelled', 'Lâmpada já trocada pela recepção');
  checks := checks + 1;

  perform public.add_work_order_item(wo1, 'Mão de obra terceirizada', 1, 120);
  select sum(unit_cost) into num from public.work_order_items_for(wo1);
  if num <> 120 then raise exception 'gestão deveria ver o custo'; end if;
  checks := checks + 1;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', u_tech2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.work_order_items_for(wo1) where unit_cost is not null;
  if n <> 0 then raise exception 'técnico sem costs.read viu custos'; end if;
  select count(*) into n from public.work_order_items_for(wo1);
  if n <> 2 then raise exception 'técnico deveria ver os 2 materiais, viu %', n; end if;
  checks := checks + 1;
  reset role;

  raise exception 'WORK_ORDER_TESTS_PASSED (% verificações)', checks;
end
$tests$;
