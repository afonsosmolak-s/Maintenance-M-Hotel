-- CNPJ alfanumérico (Receita Federal, a partir de julho/2026): 12 posições [0-9A-Z] + 2 DV numéricos.
-- Valor de cada caractere no cálculo: ascii(c) - 48.

create function app.cnpj_check_digit(p_base text)
returns int
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sum int := 0;
  v_weight int := 2;
  i int;
begin
  for i in reverse length(p_base)..1 loop
    v_sum := v_sum + (ascii(substr(p_base, i, 1)) - 48) * v_weight;
    v_weight := case when v_weight = 9 then 2 else v_weight + 1 end;
  end loop;
  return case when v_sum % 11 < 2 then 0 else 11 - v_sum % 11 end;
end;
$$;

create function app.is_valid_cnpj(p_cnpj text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_d1 int;
  v_d2 int;
begin
  if p_cnpj !~ '^[0-9A-Z]{12}[0-9]{2}$' or p_cnpj ~ '^(\d)\1{13}$' then
    return false;
  end if;
  v_d1 := app.cnpj_check_digit(substr(p_cnpj, 1, 12));
  v_d2 := app.cnpj_check_digit(substr(p_cnpj, 1, 12) || v_d1::text);
  return right(p_cnpj, 2) = v_d1::text || v_d2::text;
end;
$$;

alter table public.establishments drop constraint establishments_cnpj_check;
alter table public.establishments add constraint establishments_cnpj_check check (app.is_valid_cnpj(cnpj));

create or replace function public.create_establishment(
  p_name text,
  p_legal_name text,
  p_cnpj text,
  p_kind text,
  p_owner_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_owner_role uuid;
begin
  if not app.is_platform_admin() then
    raise exception 'Apenas a plataforma pode cadastrar estabelecimentos.' using errcode = '42501';
  end if;

  insert into public.establishments (name, legal_name, cnpj, kind)
  values (trim(p_name), trim(p_legal_name), regexp_replace(upper(p_cnpj), '[^0-9A-Z]', '', 'g'), p_kind)
  returning id into v_id;

  insert into public.roles (establishment_id, name, permissions, system_key)
  values (v_id, 'Proprietário', app.all_permissions(), 'owner')
  returning id into v_owner_role;

  insert into public.roles (establishment_id, name, permissions, system_key)
  values (v_id, 'Gerente', array_remove(app.all_permissions(), 'establishment.manage'), 'manager');

  insert into public.memberships (establishment_id, user_id, role_id)
  values (v_id, p_owner_user_id, v_owner_role);

  return v_id;
end;
$$;
