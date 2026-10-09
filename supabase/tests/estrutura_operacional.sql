-- Teste da etapa 3: locais, categorias e equipamentos.
-- Termina com uma exceção para desfazer tudo. Esperado: "ESTRUTURA_TESTS_PASSED (n verificações)".
do $tests$
declare
  u_platform uuid := gen_random_uuid();
  u_owner_a uuid := gen_random_uuid();
  u_owner_b uuid := gen_random_uuid();
  u_tech_a uuid := gen_random_uuid();
  est_a uuid;
  est_b uuid;
  role_tech uuid;
  bloco_a uuid;
  bloco_b uuid;
  suite_12 uuid;
  banheiro uuid;
  loc_b uuid;
  cat_hidro uuid;
  n int;
  v uuid;
  checks int := 0;
  failed boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (u_platform, 'p@test.local', 'authenticated', 'authenticated'),
    (u_owner_a, 'a@test.local', 'authenticated', 'authenticated'),
    (u_owner_b, 'b@test.local', 'authenticated', 'authenticated'),
    (u_tech_a, 't@test.local', 'authenticated', 'authenticated');
  insert into public.platform_admins values (u_platform);

  perform set_config('request.jwt.claims', json_build_object('sub', u_platform, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
  est_a := public.create_establishment('Motel A', 'Motel A Ltda', '11222333000181', 'motel', u_owner_a);
  est_b := public.create_establishment('Hotel B', 'Hotel B SA', '45723174000110', 'hotel', u_owner_b);
  reset role;

  -- ---------------------------------------------------------------- dono A
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  perform public.apply_establishment_template(est_a, 'motel');
  perform public.apply_establishment_template(est_a, 'motel'); -- idempotente
  select count(*) into n from public.location_types where establishment_id = est_a;
  if n <> 4 then raise exception 'modelo motel deveria criar 4 tipos, criou %', n; end if;
  select count(*) into n from public.categories where establishment_id = est_a;
  if n <> 9 then raise exception 'modelo motel deveria criar 9 categorias, criou %', n; end if;
  checks := checks + 1;

  insert into public.locations (establishment_id, name) values (est_a, 'Bloco A') returning id into bloco_a;
  insert into public.locations (establishment_id, name) values (est_a, 'Bloco B') returning id into bloco_b;
  insert into public.locations (establishment_id, parent_id, name) values (est_a, bloco_a, 'Suíte 12') returning id into suite_12;
  insert into public.locations (establishment_id, parent_id, name) values (est_a, suite_12, 'Banheiro') returning id into banheiro;

  select sector_id into v from public.locations where id = banheiro;
  if v <> bloco_a then raise exception 'setor do banheiro deveria ser o Bloco A'; end if;
  checks := checks + 1;

  update public.locations set parent_id = bloco_b where id = suite_12;
  select sector_id into v from public.locations where id = banheiro;
  if v <> bloco_b then raise exception 'ao mover a suíte, o setor do banheiro deveria mudar'; end if;
  checks := checks + 1;

  failed := false;
  begin
    update public.locations set parent_id = banheiro where id = bloco_b;
  exception when check_violation then failed := true;
  end;
  if not failed then raise exception 'aceitou ciclo na árvore de locais'; end if;
  checks := checks + 1;

  failed := false;
  begin
    insert into public.locations (establishment_id, parent_id, name) values (est_a, bloco_b, 'suíte 12');
  exception when unique_violation then failed := true;
  end;
  if not failed then raise exception 'aceitou nome repetido no mesmo nível'; end if;
  checks := checks + 1;

  select id into cat_hidro from public.categories where establishment_id = est_a and name = 'Hidromassagem';
  insert into public.assets (establishment_id, location_id, category_id, name, internal_code)
  values (est_a, suite_12, cat_hidro, 'Banheira de hidromassagem', 'HID-012');
  checks := checks + 1;

  insert into public.roles (establishment_id, name, permissions)
  values (est_a, 'Técnico', array['work_orders.create', 'work_orders.read_all', 'work_orders.execute'])
  returning id into role_tech;
  perform public.add_member(est_a, u_tech_a, role_tech);
  reset role;

  -- ---------------------------------------------------------------- dono B
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner_b, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.locations where establishment_id = est_a;
  if n <> 0 then raise exception 'dono B viu locais de A'; end if;
  select count(*) into n from public.assets where establishment_id = est_a;
  if n <> 0 then raise exception 'dono B viu equipamentos de A'; end if;
  select count(*) into n from public.categories where establishment_id = est_a;
  if n <> 0 then raise exception 'dono B viu categorias de A'; end if;
  checks := checks + 1;

  failed := false;
  begin
    insert into public.locations (establishment_id, name) values (est_a, 'Intruso');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'dono B criou local em A'; end if;
  checks := checks + 1;

  failed := false;
  begin
    perform public.apply_establishment_template(est_a, 'hotel');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'dono B aplicou modelo em A'; end if;
  checks := checks + 1;

  -- Referência cruzada: local de B com pai de A, equipamento de B num local de A.
  insert into public.locations (establishment_id, name) values (est_b, 'Torre 1') returning id into loc_b;
  failed := false;
  begin
    insert into public.locations (establishment_id, parent_id, name) values (est_b, bloco_a, 'Cruzado');
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'local de B ficou dentro de local de A'; end if;
  checks := checks + 1;

  failed := false;
  begin
    insert into public.assets (establishment_id, location_id, name) values (est_b, suite_12, 'Cruzado');
  exception when foreign_key_violation then failed := true;
  end;
  if not failed then raise exception 'equipamento de B num local de A'; end if;
  checks := checks + 1;

  update public.locations set name = 'Invadido' where id = bloco_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'dono B renomeou local de A'; end if;
  checks := checks + 1;
  reset role;

  -- ------------------------------------------------------------- técnico A
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.locations where establishment_id = est_a;
  if n <> 4 then raise exception 'técnico deveria ver os 4 locais, viu %', n; end if;
  checks := checks + 1;

  failed := false;
  begin
    insert into public.locations (establishment_id, name) values (est_a, 'Bloco C');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico criou local'; end if;
  checks := checks + 1;

  failed := false;
  begin
    insert into public.assets (establishment_id, location_id, name) values (est_a, suite_12, 'TV');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico criou equipamento'; end if;
  checks := checks + 1;
  reset role;

  -- ------------------------------------------------------------- auditoria
  select count(*) into n from public.audit_events
  where establishment_id = est_a and entity_type in ('locations', 'assets', 'categories', 'location_types');
  if n < 15 then raise exception 'esperava eventos de auditoria da estrutura, encontrou %', n; end if;
  checks := checks + 1;

  raise exception 'ESTRUTURA_TESTS_PASSED (% verificações)', checks;
end
$tests$;
