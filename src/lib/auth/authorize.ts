import "server-only";
import type { Permission } from "@/lib/domain/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireEstablishment } from "./session";

/**
 * Para Server Actions: confirma a permissão no estabelecimento e devolve o cliente
 * com a sessão do utilizador (o banco volta a verificar tudo pela RLS).
 * Devolve null quando falta a permissão.
 */
export async function authorizeAction(establishmentId: string, permission: Permission) {
  const { can } = await requireEstablishment(establishmentId);
  if (!can(permission)) return null;
  return createSupabaseServerClient();
}
