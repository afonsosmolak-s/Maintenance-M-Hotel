-- Teste de isolamento multi-tenant e permissões da etapa 2.
-- Executa tudo dentro de um bloco que termina com uma exceção, para desfazer todas as
-- alterações. Resultado esperado: "TENANCY_TESTS_PASSED (n verificações)".
-- Para correr: colar no SQL editor do Supabase (ou via execute_sql) num projeto de desenvolvimento.
do $tests$
declare
  u_platform uuid := gen_random_uuid();
  u_owner_a uuid := gen_random_uuid();
  u_owner_b uuid := gen_random_uuid();
  u_manager_a uuid := gen_random_uuid();
  u_tech_a uuid := gen_random_uuid();
  est_a uuid;
  est_b uuid;
  role_owner_a uuid;
  role_manager_a uuid;
  role_tech_a uuid;
  role_manager_b uuid;
  n int;
  checks int := 0;
  failed boolean;

begin
  set constraints all immediate;

  insert into auth.users (id, email, aud, role)
  values
    (u_platform, 'platform@test.local', 'authenticated', 'authenticated'),
    (u_owner_a, 'owner-a@test.local', 'authenticated', 'authenticated'),
    (u_owner_b, 'owner-b@test.local', 'authenticated', 'authenticated'),
    (u_manager_a, 'manager-a@test.local', 'authenticated', 'authenticated'),
    (u_tech_a, 'tech-a@test.local', 'authenticated', 'authenticated');
  insert into public.platform_admins (user_id) values (u_platform);

  -- ---------------------------------------------------------------- plataforma
  perform set_config('request.jwt.claims', json_build_object('sub', u_platform, 'role', 'authenticated')::text, true);
  set local role authenticated;

  est_a := public.create_establishment('Motel A', 'Motel A Ltda', '11.111.111/0001-11', 'motel', u_owner_a);
  est_b := public.create_establishment('Hotel B', 'Hotel B SA', '22222222000122', 'hotel', u_owner_b);
  select count(*) into n from public.establishments;
  if n <> 2 then raise exception 'plataforma deveria ver 2 estabelecimentos, viu %', n; end if;
  checks := checks + 1;

  reset role;
  select id into role_owner_a from public.roles where establishment_id = est_a and system_key = 'owner';
  select id into role_manager_a from public.roles where establishment_id = est_a and system_key = 'manager';
  select id into role_manager_b from public.roles where establishment_id = est_b and system_key = 'manager';

  -- ------------------------------------------------------------- dono do A
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.establishments;
  if n <> 1 then raise exception 'dono A deveria ver só 1 estabelecimento, viu %', n; end if;
  checks := checks + 1;

  select count(*) into n from public.establishments where id = est_b;
  if n <> 0 then raise exception 'dono A viu o estabelecimento B'; end if;
  checks := checks + 1;

  select count(*) into n from public.roles where establishment_id = est_b;
  if n <> 0 then raise exception 'dono A viu cargos de B'; end if;
  checks := checks + 1;

  select count(*) into n from public.memberships where establishment_id = est_b;
  if n <> 0 then raise exception 'dono A viu membros de B'; end if;
  checks := checks + 1;

  select count(*) into n from public.audit_events where establishment_id = est_b;
  if n <> 0 then raise exception 'dono A viu auditoria de B'; end if;
  checks := checks + 1;

  select count(*) into n from public.profiles where id = u_owner_b;
  if n <> 0 then raise exception 'dono A viu o perfil do dono B'; end if;
  checks := checks + 1;

  update public.establishments set name = 'Invadido' where id = est_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'dono A alterou o estabelecimento B'; end if;
  checks := checks + 1;

  failed := false;
  begin
    insert into public.roles (establishment_id, name, permissions) values (est_b, 'Intruso', '{}');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'dono A criou cargo em B'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.add_member(est_b, u_owner_a, role_manager_b);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'dono A entrou em B via add_member'; end if;
  checks := checks + 1;

  -- Cargo de B não pode ser usado em A (FK composta).
  failed := false;
  begin
    perform public.add_member(est_a, u_tech_a, role_manager_b);
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'cargo de B foi usado em A'; end if;
  checks := checks + 1;

  failed := false;
  begin
    update public.establishments set status = 'suspended' where id = est_a;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'dono suspendeu a própria conta'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.create_establishment('X', 'X Ltda', '33333333000133', 'hotel', u_owner_a);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'dono criou estabelecimento'; end if;
  checks := checks + 1;

  -- Dono cria cargo personalizado e monta a equipe.
  insert into public.roles (establishment_id, name, permissions)
  values (est_a, 'Técnico', array['work_orders.create', 'work_orders.read_all', 'work_orders.execute'])
  returning id into role_tech_a;
  perform public.add_member(est_a, u_manager_a, role_manager_a);
  perform public.add_member(est_a, u_tech_a, role_tech_a);
  checks := checks + 1;

  failed := false;
  begin
    insert into public.roles (establishment_id, name, permissions) values (est_a, 'Inválido', array['tudo']);
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'cargo aceitou permissão fora do catálogo'; end if;
  checks := checks + 1;

  failed := false;
  begin
    update public.roles set permissions = '{}' where id = role_owner_a;
    select count(*) into n from public.roles where id = role_owner_a and permissions = app.all_permissions();
    if n = 1 then failed := true; end if;
  end;
  if not failed then raise exception 'permissões do Proprietário foram reduzidas'; end if;
  checks := checks + 1;

  failed := false;
  begin
    delete from public.memberships where user_id = u_owner_a and establishment_id = est_a;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'o último Proprietário foi removido'; end if;
  checks := checks + 1;

  -- ------------------------------------------------------------ gerente do A
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_manager_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  failed := false;
  begin
    update public.memberships set role_id = role_owner_a where user_id = u_manager_a and establishment_id = est_a;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'gerente se promoveu a Proprietário'; end if;
  checks := checks + 1;

  failed := false;
  begin
    delete from public.memberships where user_id = u_owner_a and establishment_id = est_a;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'gerente removeu o Proprietário'; end if;
  checks := checks + 1;

  select count(*) into n from public.profiles where id in (u_owner_a, u_tech_a);
  if n <> 2 then raise exception 'gerente deveria ver o perfil dos colegas, viu %', n; end if;
  checks := checks + 1;

  -- ----------------------------------------------------------- técnico do A
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.roles set name = 'Chefe' where id = role_tech_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'técnico alterou cargos'; end if;
  checks := checks + 1;

  select count(*) into n from public.audit_events;
  if n <> 0 then raise exception 'técnico leu a auditoria'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.add_member(est_a, u_owner_b, role_tech_a);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico adicionou membro'; end if;
  checks := checks + 1;

  -- ------------------------------------------------------------ auditoria
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.audit_events where establishment_id = est_a;
  if n < 5 then raise exception 'esperava eventos de auditoria em A, encontrou %', n; end if;
  checks := checks + 1;

  failed := false;
  begin
    delete from public.audit_events where establishment_id = est_a;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'auditoria foi apagada'; end if;
  checks := checks + 1;

  failed := false;
  begin
    update public.audit_events set action = 'x' where establishment_id = est_a;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'auditoria foi alterada'; end if;
  checks := checks + 1;

  -- --------------------------------------------- conta suspensa perde acesso
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_platform, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.set_establishment_status(est_a, 'suspended');

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.roles where establishment_id = est_a;
  if n <> 0 then raise exception 'conta suspensa ainda vê dados'; end if;
  checks := checks + 1;

  -- ------------------------------------------------------------ anónimo
  reset role;
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  set local role anon;
  select count(*) into n from public.establishments;
  if n <> 0 then raise exception 'anónimo viu estabelecimentos'; end if;
  checks := checks + 1;

  reset role;
  raise exception 'TENANCY_TESTS_PASSED (% verificações)', checks;
end
$tests$;
