-- Teste da etapa 7: painel de TV.
-- Termina com uma exceção para desfazer tudo. Esperado: "DISPLAY_TESTS_PASSED (n verificações)".
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
  disp uuid;
  dev uuid;
  secret_h text := encode(sha256('segredo-teste'::bytea), 'hex');
  token_h text := encode(sha256('token-teste'::bytea), 'hex');
  feed jsonb;
  n int;
  t text;
  checks int := 0;
  failed boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (u_platform, 'p@test.local', 'authenticated', 'authenticated'),
    (u_owner, 'o@test.local', 'authenticated', 'authenticated'),
    (u_other, 'x@test.local', 'authenticated', 'authenticated'),
    (u_tech, 't@test.local', 'authenticated', 'authenticated');
  insert into public.profiles (id, full_name) values (u_tech, 'João Pereira') on conflict (id) do update set full_name = excluded.full_name;
  insert into public.platform_admins values (u_platform);

  perform set_config('request.jwt.claims', json_build_object('sub', u_platform, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  set local role authenticated;
  est := public.create_establishment('Motel T', 'Motel T Ltda', '11222333000181', 'motel', u_owner);
  est_other := public.create_establishment('Hotel X', 'Hotel X SA', '45723174000110', 'hotel', u_other);
  reset role;
  perform set_config('request.jwt.claims', '', true);

  insert into public.locations (establishment_id, name) values (est, 'Bloco A') returning id into bloco_a;
  insert into public.locations (establishment_id, name) values (est, 'Bloco B') returning id into bloco_b;
  insert into public.locations (establishment_id, parent_id, name) values (est, bloco_a, 'Suíte 12') returning id into suite;
  insert into public.roles (establishment_id, name, permissions)
  values (est, 'Técnico', array['work_orders.create', 'work_orders.read_all', 'work_orders.execute']) returning id into role_tech;
  insert into public.memberships (establishment_id, user_id, role_id) values (est, u_tech, role_tech);
  insert into public.work_orders (establishment_id, number, title, description, location_id, priority, status, reported_by, assignee_id, due_at)
  values
    (est, 1, 'Banheira com vazamento', 'Detalhe privado', suite, 'critical', 'in_progress', u_owner, u_tech, now() - interval '1 hour'),
    (est, 2, 'Lâmpada queimada', null, bloco_b, 'low', 'pending', u_owner, null, now() + interval '3 days');
  insert into public.work_orders (establishment_id, number, title, location_id, priority, status, reported_by, assignee_id, completed_at, completion_summary)
  values (est, 3, 'Já resolvida', suite, 'high', 'done', u_owner, u_tech, now(), 'ok');

  -- ------------------------------------------------------------- gestão cria o painel
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.displays (establishment_id, name, config)
  values (est, 'Sala de manutenção', jsonb_build_object('sectorIds', jsonb_build_array(bloco_a)))
  returning id into disp;
  reset role;

  -- ------------------------------------------------------------- TV pede código
  perform public.display_pairing_start('ABC234', secret_h);
  if public.display_pairing_exchange(secret_h, token_h) <> 'waiting' then raise exception 'deveria aguardar'; end if;
  checks := checks + 1;

  -- Técnico sem displays.manage não pareia.
  perform set_config('request.jwt.claims', json_build_object('sub', u_tech, 'role', 'authenticated')::text, true);
  set local role authenticated;
  failed := false;
  begin
    perform public.claim_display_pairing(est, 'abc-234', disp, 'TV');
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'técnico pareou TV'; end if;
  reset role;

  -- Outro cliente não usa o painel de A nem pareia em A.
  perform set_config('request.jwt.claims', json_build_object('sub', u_other, 'role', 'authenticated')::text, true);
  set local role authenticated;
  failed := false;
  begin
    perform public.claim_display_pairing(est_other, 'ABC234', disp, 'TV');
  exception when no_data_found then failed := true;
  end;
  if not failed then raise exception 'outro cliente usou painel de A'; end if;
  select count(*) into n from public.displays where establishment_id = est;
  if n <> 0 then raise exception 'outro cliente viu painéis de A'; end if;
  reset role;
  checks := checks + 1;

  -- Dono aceita (código com hífen e minúsculas também serve).
  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.claim_display_pairing(est, 'abc-234', disp, 'TV da manutenção');
  failed := false;
  begin
    perform public.claim_display_pairing(est, 'ABC234', disp, 'Outra');
  exception when no_data_found then failed := true;
  end;
  if not failed then raise exception 'código foi usado duas vezes'; end if;
  reset role;
  checks := checks + 1;

  if public.display_pairing_exchange(secret_h, token_h) <> 'paired' then raise exception 'deveria parear'; end if;
  if public.display_pairing_exchange(secret_h, token_h) <> 'invalid' then raise exception 'troca repetida aceite'; end if;
  select id into dev from public.display_devices where token_hash = token_h;
  checks := checks + 1;

  -- ------------------------------------------------------------- feed
  feed := public.display_feed(token_h);
  if feed is null then raise exception 'feed vazio'; end if;
  if jsonb_array_length(feed -> 'items') <> 1 then raise exception 'filtro por setor falhou: %', feed -> 'items'; end if;
  if feed -> 'items' -> 0 ->> 'location' <> 'Bloco A › Suíte 12' then raise exception 'local errado: %', feed -> 'items' -> 0 ->> 'location'; end if;
  if feed -> 'items' -> 0 ->> 'assignee' <> 'João' then raise exception 'deveria mostrar só o primeiro nome'; end if;
  if (feed -> 'counts' ->> 'critical')::int <> 1 or (feed -> 'counts' ->> 'overdue')::int <> 1 then raise exception 'contagens erradas'; end if;
  if feed::text like '%Detalhe privado%' or feed::text like '%' || u_owner::text || '%' then
    raise exception 'feed expõe dados além do necessário';
  end if;
  checks := checks + 1;

  if public.display_feed(encode(sha256('token-errado'::bytea), 'hex')) is not null then raise exception 'token errado aceite'; end if;
  checks := checks + 1;

  -- ------------------------------------------------------------- segredos
  select count(*) into n from public.audit_events where entity_type = 'display_devices' and (after ? 'token_hash' or before ? 'token_hash');
  if n <> 0 then raise exception 'hash do token foi parar na auditoria'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u_owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.display_devices where establishment_id = est;
  if n <> 1 then raise exception 'gestão deveria ver a TV'; end if;
  failed := false;
  begin
    select token_hash into t from public.display_devices where id = dev;
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'gestão leu o hash do token'; end if;
  failed := false;
  begin
    perform public.display_feed(token_h);
  exception when insufficient_privilege then failed := true;
  end;
  if not failed then raise exception 'utilizador chamou a função do dispositivo'; end if;
  checks := checks + 1;

  -- ------------------------------------------------------------- revogação
  perform public.revoke_display_device(dev);
  reset role;
  if public.display_feed(token_h) is not null then raise exception 'TV revogada continua a receber dados'; end if;
  checks := checks + 1;

  -- Conta suspensa: um segundo dispositivo também deixa de receber.
  insert into public.display_devices (establishment_id, display_id, name, token_hash, expires_at)
  values (est, disp, 'TV 2', encode(sha256('token-2'::bytea), 'hex'), now() + interval '90 days');
  if public.display_feed(encode(sha256('token-2'::bytea), 'hex')) is null then raise exception 'TV 2 deveria funcionar'; end if;
  perform set_config('request.jwt.claims', '', true); -- como o servidor: sem utilizador
  update public.establishments set status = 'suspended' where id = est;
  if public.display_feed(encode(sha256('token-2'::bytea), 'hex')) is not null then raise exception 'conta suspensa ainda mostra dados'; end if;
  checks := checks + 1;

  -- Validade deslizante: perto de expirar, renova.
  update public.establishments set status = 'active' where id = est;
  update public.display_devices set expires_at = now() + interval '3 days' where token_hash = encode(sha256('token-2'::bytea), 'hex');
  feed := public.display_feed(encode(sha256('token-2'::bytea), 'hex'));
  if not (feed ->> 'renewed')::boolean then raise exception 'deveria renovar'; end if;
  select count(*) into n from public.display_devices where token_hash = encode(sha256('token-2'::bytea), 'hex') and expires_at > now() + interval '80 days';
  if n <> 1 then raise exception 'validade não foi estendida'; end if;
  checks := checks + 1;

  raise exception 'DISPLAY_TESTS_PASSED (% verificações)', checks;
end
$tests$;
