-- Etapa 7 — Painel de TV.
-- A TV não tem sessão de utilizador: recebe uma credencial própria (token opaco) num cookie
-- HttpOnly. O banco guarda só o sha256 do token. As funções do dispositivo só podem ser
-- chamadas pelo servidor (service_role) e devolvem apenas os campos do ecrã.

create table public.displays (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 60),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, id)
);

create table public.display_devices (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null,
  display_id uuid not null,
  name text not null check (length(trim(name)) between 2 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  foreign key (establishment_id, display_id) references public.displays (establishment_id, id) on delete cascade
);
create index display_devices_display_idx on public.display_devices (establishment_id, display_id);
create index display_devices_created_by_idx on public.display_devices (created_by);
create index display_devices_revoked_by_idx on public.display_devices (revoked_by);

-- Códigos de pareamento temporários (10 minutos). Só o servidor acede.
create table public.display_pairings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  secret_hash text not null unique check (secret_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  establishment_id uuid references public.establishments (id) on delete cascade,
  display_id uuid,
  device_name text,
  claimed_by uuid references public.profiles (id),
  claimed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index display_pairings_expires_idx on public.display_pairings (expires_at);
create index display_pairings_establishment_idx on public.display_pairings (establishment_id);
create index display_pairings_claimed_by_idx on public.display_pairings (claimed_by);

create trigger touch before update on public.displays for each row execute function app.touch_updated_at();
create trigger audit after insert or update or delete on public.displays for each row execute function app.audit_row();
create trigger audit after insert or delete on public.display_devices for each row execute function app.audit_row();
create trigger audit_revoke after update of revoked_at on public.display_devices for each row execute function app.audit_row();

alter table public.displays enable row level security;
alter table public.display_devices enable row level security;
alter table public.display_pairings enable row level security; -- sem políticas: só service_role

create policy "gestão de TV vê painéis" on public.displays
  for select to authenticated using (app.has_permission(establishment_id, 'displays.manage'));
create policy "gestão de TV gere painéis" on public.displays
  for all to authenticated
  using (app.has_permission(establishment_id, 'displays.manage'))
  with check (app.has_permission(establishment_id, 'displays.manage'));

create policy "gestão de TV vê dispositivos" on public.display_devices
  for select to authenticated using (app.has_permission(establishment_id, 'displays.manage'));
-- token_hash nunca sai do servidor: leitura só das outras colunas.
revoke select on public.display_devices from anon, authenticated;
grant select (id, establishment_id, display_id, name, expires_at, last_seen_at, created_by, created_at, revoked_at, revoked_by)
  on public.display_devices to authenticated;

-- ---------------------------------------------------------------------------
-- Gestão (utilizador autenticado)
-- ---------------------------------------------------------------------------
create function public.claim_display_pairing(p_establishment_id uuid, p_code text, p_display_id uuid, p_device_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_id uuid;
begin
  if not app.has_permission(p_establishment_id, 'displays.manage') then
    raise exception 'Sem permissão para parear TVs.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.displays where id = p_display_id and establishment_id = p_establishment_id and active) then
    raise exception 'Painel inválido.' using errcode = 'P0002';
  end if;

  update public.display_pairings
  set establishment_id = p_establishment_id,
      display_id = p_display_id,
      device_name = coalesce(nullif(trim(p_device_name), ''), 'TV'),
      claimed_by = (select auth.uid()),
      claimed_at = now()
  where code = v_code and expires_at > now() and claimed_at is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Código inválido ou expirado. Confira o código na TV.' using errcode = 'P0002';
  end if;
end;
$$;

create function public.revoke_display_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_est uuid;
begin
  select establishment_id into v_est from public.display_devices where id = p_device_id;
  if v_est is null or not app.has_permission(v_est, 'displays.manage') then
    raise exception 'Dispositivo não encontrado.' using errcode = 'P0002';
  end if;
  update public.display_devices set revoked_at = now(), revoked_by = (select auth.uid())
  where id = p_device_id and revoked_at is null;
end;
$$;

revoke execute on function public.claim_display_pairing(uuid, text, uuid, text), public.revoke_display_device(uuid) from public, anon;
grant execute on function public.claim_display_pairing(uuid, text, uuid, text), public.revoke_display_device(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Dispositivo (só o servidor, com a chave secreta)
-- ---------------------------------------------------------------------------
create function public.display_pairing_start(p_code text, p_secret_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expires timestamptz := now() + interval '10 minutes';
begin
  delete from public.display_pairings where expires_at < now() - interval '1 day';
  insert into public.display_pairings (code, secret_hash, expires_at) values (p_code, p_secret_hash, v_expires);
  return v_expires;
end;
$$;

-- A TV pergunta se o código já foi aceite. Se sim, troca o segredo do pareamento pela credencial.
create function public.display_pairing_exchange(p_secret_hash text, p_token_hash text, p_valid_days int default 90)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.display_pairings;
begin
  select * into p from public.display_pairings where secret_hash = p_secret_hash for update;
  if not found or p.consumed_at is not null then return 'invalid'; end if;
  if p.claimed_at is null then
    return case when p.expires_at > now() then 'waiting' else 'expired' end;
  end if;
  if p.claimed_at < now() - interval '10 minutes' then return 'expired'; end if;

  perform set_config('app.actor_type', 'device', true);
  insert into public.display_devices (establishment_id, display_id, name, token_hash, expires_at, created_by)
  values (p.establishment_id, p.display_id, p.device_name, p_token_hash, now() + make_interval(days => p_valid_days), p.claimed_by);
  update public.display_pairings set consumed_at = now() where id = p.id;
  perform set_config('app.actor_type', '', true);
  return 'paired';
end;
$$;

-- Dados do ecrã para a credencial dada; null se inválida, revogada, expirada, painel ou conta inativos.
-- Renova a validade (janela deslizante) e regista o último contacto (no máximo 1 escrita por minuto).
create function public.display_feed(p_token_hash text, p_valid_days int default 90)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.display_devices;
  v_display public.displays;
  v_est public.establishments;
  v_cfg jsonb;
  v_sectors uuid[];
  v_priorities text[];
  v_statuses text[];
  v_items jsonb;
  v_counts jsonb;
  v_renewed boolean := false;
begin
  select * into d from public.display_devices where token_hash = p_token_hash;
  if not found or d.revoked_at is not null or d.expires_at < now() then return null; end if;
  select * into v_display from public.displays where id = d.display_id;
  select * into v_est from public.establishments where id = d.establishment_id;
  if not v_display.active or v_est.status <> 'active' then return null; end if;

  if d.last_seen_at is null or d.last_seen_at < now() - interval '1 minute' or d.expires_at < now() + interval '15 days' then
    v_renewed := d.expires_at < now() + interval '15 days';
    update public.display_devices
    set last_seen_at = now(),
        expires_at = case when v_renewed then now() + make_interval(days => p_valid_days) else expires_at end
    where id = d.id;
  end if;

  v_cfg := v_display.config;
  v_sectors := array(select jsonb_array_elements_text(coalesce(v_cfg -> 'sectorIds', '[]'::jsonb))::uuid);
  v_priorities := array(select jsonb_array_elements_text(coalesce(v_cfg -> 'priorities', '["critical","high","medium","low"]'::jsonb)));
  v_statuses := array(select jsonb_array_elements_text(coalesce(v_cfg -> 'statuses', '["pending","assigned","in_progress","on_hold"]'::jsonb)));

  -- Contagens sobre tudo; lista limitada já na ordem de urgência (as críticas nunca ficam de fora).
  with recursive path as (
    select l.id, l.parent_id, l.name::text as label, l.id as origin
    from public.locations l where l.establishment_id = d.establishment_id
    union all
    select p.id, parent.parent_id, parent.name || ' › ' || p.label, p.origin
    from path p join public.locations parent on parent.id = p.parent_id
  ),
  labels as (
    select origin as id, label from path where parent_id is null
  ),
  wo as (
    select w.number, left(w.title, 80) as title, w.priority, w.status, w.opened_at, w.due_at,
           (w.due_at is not null and w.due_at < now()) as overdue,
           w.source = 'preventive' as preventive,
           lab.label as location,
           case when coalesce((v_cfg ->> 'showAssignee')::boolean, true)
                then split_part(nullif(pr.full_name, ''), ' ', 1) end as assignee,
           case w.priority when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end as rank_priority
    from public.work_orders w
    join public.locations l on l.id = w.location_id
    left join labels lab on lab.id = w.location_id
    left join public.profiles pr on pr.id = w.assignee_id
    where w.establishment_id = d.establishment_id
      and w.status = any (v_statuses)
      and w.status in ('pending', 'assigned', 'in_progress', 'on_hold')
      and w.priority = any (v_priorities)
      and (cardinality(v_sectors) = 0 or l.sector_id = any (v_sectors))
  )
  select
    (select jsonb_build_object(
        'critical', count(*) filter (where priority = 'critical'),
        'overdue', count(*) filter (where overdue),
        'inProgress', count(*) filter (where status = 'in_progress'),
        'pending', count(*) filter (where status in ('pending', 'assigned')),
        'onHold', count(*) filter (where status = 'on_hold'),
        'total', count(*))
     from wo),
    (select coalesce(jsonb_agg(jsonb_build_object(
        'number', number, 'title', title, 'priority', priority, 'status', status, 'openedAt', opened_at,
        'dueAt', due_at, 'overdue', overdue, 'preventive', preventive, 'location', location, 'assignee', assignee
      ) order by rank_priority desc, overdue desc, due_at nulls last, opened_at), '[]'::jsonb)
     from (select * from wo order by rank_priority desc, overdue desc, due_at nulls last, opened_at limit 300) top)
  into v_counts, v_items;

  return jsonb_build_object(
    'establishment', case when coalesce((v_cfg ->> 'showEstablishment')::boolean, true) then v_est.name end,
    'display', v_display.name,
    'layout', coalesce(v_cfg ->> 'layout', 'urgent_rotation'),
    'rotationSeconds', least(greatest(coalesce((v_cfg ->> 'rotationSeconds')::int, 12), 6), 60),
    'counts', v_counts,
    'items', v_items,
    'renewed', v_renewed,
    'generatedAt', now()
  );
end;
$$;

revoke execute on function
  public.display_pairing_start(text, text),
  public.display_pairing_exchange(text, text, int),
  public.display_feed(text, int)
from public, anon, authenticated;
grant execute on function
  public.display_pairing_start(text, text),
  public.display_pairing_exchange(text, text, int),
  public.display_feed(text, int)
to service_role;

-- Auditoria sem segredos: hashes de credenciais nunca entram nos eventos.
create or replace function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text[] := array['token_hash', 'secret_hash'];
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - v_secret end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - v_secret end;
  v_row jsonb := coalesce(v_new, v_old);
  v_ignored text[] := array['updated_at', 'created_at', 'work_order_seq', 'last_seen_at'];
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
