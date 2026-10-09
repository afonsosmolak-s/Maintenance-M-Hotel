import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestOrigin } from "./origin";

/**
 * Garante que existe uma conta no Auth para o e-mail e devolve o seu id.
 * Conta nova recebe o e-mail de convite (definir nome e senha em /auth/aceitar).
 * Quem chama TEM de ter verificado antes a permissão de quem convida;
 * o vínculo ao estabelecimento é feito depois com a sessão do próprio utilizador (RPC auditada).
 */
export async function ensureInvitedUser(email: string, fullName: string): Promise<{ userId: string; invited: boolean }> {
  const admin = createSupabaseAdminClient();

  const { data: existingId, error: lookupError } = await admin.rpc("find_user_id_by_email", { p_email: email });
  if (lookupError) throw new Error("Falha ao procurar o utilizador.");
  if (existingId) return { userId: existingId, invited: false };

  const origin = await getRequestOrigin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${origin}/auth/aceitar`,
  });
  if (error || !data.user) throw new Error("Não foi possível enviar o convite por e-mail.");
  return { userId: data.user.id, invited: true };
}
