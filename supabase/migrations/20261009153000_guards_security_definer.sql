-- As verificações de integridade de memberships não podem depender da RLS de quem executa:
-- quem se remove deixa de "ver" o estabelecimento e a verificação passava em branco.
alter function app.ensure_owner_remains() security definer;
alter function app.guard_memberships() security definer;
