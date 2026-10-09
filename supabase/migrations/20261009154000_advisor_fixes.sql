-- Ajustes apontados pelos advisors do Supabase.

-- Função de event trigger da plataforma (liga RLS em tabelas novas): não precisa de ser chamável pela API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Índice para a FK composta memberships → roles.
create index memberships_establishment_role_idx on public.memberships (establishment_id, role_id);

-- Nota: create_establishment, add_member e set_establishment_status são SECURITY DEFINER
-- de propósito: são a única porta de escrita nessas tabelas e verificam a permissão no início.
