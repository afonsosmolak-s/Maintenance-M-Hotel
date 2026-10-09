-- Etapa 3 — Estrutura operacional: tipos de local, árvore de locais, categorias e equipamentos.
-- Tudo por estabelecimento; FKs compostas (establishment_id, id) impedem referências cruzadas.

-- ---------------------------------------------------------------------------
-- Tipos de local (vocabulário do estabelecimento: Suíte, Quarto, Bloco, Andar…)
-- ---------------------------------------------------------------------------
create table public.location_types (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 40),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, name),
  unique (establishment_id, id)
);

-- ---------------------------------------------------------------------------
-- Locais: árvore única. sector_id = raiz da árvore (o "setor" dos filtros).
-- ---------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  parent_id uuid,
  location_type_id uuid,
  name text not null check (length(trim(name)) between 1 and 80),
  code text check (length(code) <= 20),
  sector_id uuid,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, id),
  foreign key (establishment_id, parent_id) references public.locations (establishment_id, id),
  foreign key (establishment_id, location_type_id) references public.location_types (establishment_id, id),
  check (parent_id is distinct from id)
);

create unique index locations_unique_name_idx
  on public.locations (establishment_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index locations_parent_idx on public.locations (establishment_id, parent_id);
create index locations_type_idx on public.locations (establishment_id, location_type_id);
create index locations_sector_idx on public.locations (establishment_id, sector_id);

-- Mantém sector_id e impede ciclos (mover um local para dentro de um descendente).
create function app.locations_maintain_tree()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_root uuid;
begin
  if new.parent_id is null then
    new.sector_id := new.id;
    return new;
  end if;

  if tg_op = 'UPDATE' and exists (
    with recursive up as (
      select id, parent_id from public.locations where id = new.parent_id
      union all
      select l.id, l.parent_id from public.locations l join up on l.id = up.parent_id
    )
    select 1 from up where id = new.id
  ) then
    raise exception 'Um local não pode ficar dentro de si próprio.' using errcode = '23514';
  end if;

  with recursive up as (
    select id, parent_id from public.locations where id = new.parent_id
    union all
    select l.id, l.parent_id from public.locations l join up on l.id = up.parent_id
  )
  select id into v_root from up where parent_id is null limit 1;

  new.sector_id := v_root;
  return new;
end;
$$;

create trigger maintain_tree before insert or update of parent_id on public.locations
  for each row execute function app.locations_maintain_tree();

-- Ao mover um local, os descendentes passam a ter o novo setor.
create function app.locations_propagate_sector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sector_id is distinct from old.sector_id then
    with recursive down as (
      select id from public.locations where parent_id = new.id
      union all
      select l.id from public.locations l join down on l.parent_id = down.id
    )
    update public.locations set sector_id = new.sector_id where id in (select id from down);
  end if;
  return null;
end;
$$;

create trigger propagate_sector after update of sector_id on public.locations
  for each row execute function app.locations_propagate_sector();

-- ---------------------------------------------------------------------------
-- Categorias de manutenção (também classificam equipamentos)
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 40),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, id)
);

create unique index categories_unique_name_idx on public.categories (establishment_id, lower(name));

-- ---------------------------------------------------------------------------
-- Equipamentos e ativos
-- ---------------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments (id) on delete cascade,
  location_id uuid not null,
  category_id uuid,
  name text not null check (length(trim(name)) between 2 and 80),
  internal_code text check (length(internal_code) <= 30),
  manufacturer text check (length(manufacturer) <= 60),
  model text check (length(model) <= 60),
  installed_on date,
  warranty_until date,
  operational_status text not null default 'operational'
    check (operational_status in ('operational', 'degraded', 'down', 'retired')),
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (establishment_id, id),
  foreign key (establishment_id, location_id) references public.locations (establishment_id, id),
  foreign key (establishment_id, category_id) references public.categories (establishment_id, id)
);

create unique index assets_internal_code_idx
  on public.assets (establishment_id, lower(internal_code)) where internal_code is not null;
create index assets_location_idx on public.assets (establishment_id, location_id);
create index assets_category_idx on public.assets (establishment_id, category_id);

-- ---------------------------------------------------------------------------
-- updated_at, auditoria, RLS
-- ---------------------------------------------------------------------------
create trigger touch before update on public.location_types for each row execute function app.touch_updated_at();
create trigger touch before update on public.locations for each row execute function app.touch_updated_at();
create trigger touch before update on public.categories for each row execute function app.touch_updated_at();
create trigger touch before update on public.assets for each row execute function app.touch_updated_at();

create trigger audit after insert or update or delete on public.location_types for each row execute function app.audit_row();
create trigger audit after insert or update or delete on public.locations for each row execute function app.audit_row();
create trigger audit after insert or update or delete on public.categories for each row execute function app.audit_row();
create trigger audit after insert or update or delete on public.assets for each row execute function app.audit_row();

alter table public.location_types enable row level security;
alter table public.locations enable row level security;
alter table public.categories enable row level security;
alter table public.assets enable row level security;

create policy "membros veem tipos de local" on public.location_types
  for select to authenticated using (app.is_member(establishment_id));
create policy "configuração gere tipos de local" on public.location_types
  for all to authenticated
  using (app.has_permission(establishment_id, 'settings.manage'))
  with check (app.has_permission(establishment_id, 'settings.manage'));

create policy "membros veem locais" on public.locations
  for select to authenticated using (app.is_member(establishment_id));
create policy "configuração gere locais" on public.locations
  for all to authenticated
  using (app.has_permission(establishment_id, 'settings.manage'))
  with check (app.has_permission(establishment_id, 'settings.manage'));

create policy "membros veem categorias" on public.categories
  for select to authenticated using (app.is_member(establishment_id));
create policy "configuração gere categorias" on public.categories
  for all to authenticated
  using (app.has_permission(establishment_id, 'settings.manage'))
  with check (app.has_permission(establishment_id, 'settings.manage'));

create policy "membros veem equipamentos" on public.assets
  for select to authenticated using (app.is_member(establishment_id));
create policy "equipamentos geridos por quem tem permissão" on public.assets
  for all to authenticated
  using (app.has_permission(establishment_id, 'assets.manage'))
  with check (app.has_permission(establishment_id, 'assets.manage'));

-- ---------------------------------------------------------------------------
-- Modelos iniciais (só pré-preenchem dados; não há código diferente por tipo)
-- ---------------------------------------------------------------------------
create function public.apply_establishment_template(p_establishment_id uuid, p_template text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_types text[];
  v_categories text[];
begin
  if not app.has_permission(p_establishment_id, 'settings.manage') then
    raise exception 'Sem permissão para configurar o estabelecimento.' using errcode = '42501';
  end if;

  case p_template
    when 'motel' then
      v_types := array['Bloco', 'Suíte', 'Área técnica', 'Área comum'];
      v_categories := array['Hidromassagem', 'Hidráulica', 'Elétrica', 'Iluminação', 'Climatização',
                            'TV e eletrônicos', 'Mobiliário', 'Portas e fechaduras', 'Pintura e acabamento'];
    when 'hotel' then
      v_types := array['Torre', 'Andar', 'Quarto', 'Área comum', 'Área técnica'];
      v_categories := array['Climatização', 'Hidráulica', 'Elétrica', 'Iluminação', 'Elevadores',
                            'Cozinha', 'Lavanderia', 'TV e eletrônicos', 'Mobiliário', 'Portas e fechaduras'];
    when 'blank' then
      return;
    else
      raise exception 'Modelo desconhecido.' using errcode = '22023';
  end case;

  insert into public.location_types (establishment_id, name, sort_order)
  select p_establishment_id, t.name, t.ord
  from unnest(v_types) with ordinality as t(name, ord)
  on conflict (establishment_id, name) do nothing;

  insert into public.categories (establishment_id, name, sort_order)
  select p_establishment_id, c.name, c.ord
  from unnest(v_categories) with ordinality as c(name, ord)
  where not exists (
    select 1 from public.categories x where x.establishment_id = p_establishment_id and lower(x.name) = lower(c.name)
  );
end;
$$;

revoke execute on function public.apply_establishment_template(uuid, text) from public, anon;
grant execute on function public.apply_establishment_template(uuid, text) to authenticated;
