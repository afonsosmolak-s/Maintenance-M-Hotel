import "server-only";
import { notFound, redirect } from "next/navigation";
import { isPermission, type Permission } from "@/lib/domain/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; email: string; aal: string };

/** Utilizador da sessão atual, ou null. A assinatura do token é verificada. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: String(claims.email ?? ""), aal: String(claims.aal ?? "aal1") };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}

export type MyEstablishment = {
  id: string;
  name: string;
  kind: string;
  roleName: string;
  isOwner: boolean;
  /** Conta suspensa pela plataforma ou membership suspensa. */
  blocked: boolean;
  permissions: ReadonlySet<Permission>;
};

export async function getMyEstablishments(): Promise<MyEstablishment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_establishments");
  if (error) throw new Error("Não foi possível carregar os estabelecimentos.");

  return data.map((row) => ({
    id: row.establishment_id,
    name: row.name,
    kind: row.kind,
    roleName: row.role_name,
    isOwner: row.is_owner,
    blocked: row.establishment_status !== "active" || row.membership_status !== "active",
    permissions: new Set(row.permissions.filter(isPermission)),
  }));
}

/**
 * Contexto de um estabelecimento para as páginas em /e/[id].
 * Esconde a existência do estabelecimento a quem não é membro ativo.
 */
export async function requireEstablishment(establishmentId: string) {
  await requireUser();
  const establishment = (await getMyEstablishments()).find((e) => e.id === establishmentId);
  if (!establishment || establishment.blocked) notFound();

  return {
    establishment,
    can: (permission: Permission) => establishment.permissions.has(permission),
  };
}

export type PlatformAccess = "none" | "needs_mfa" | "verified";

export async function getPlatformAccess(): Promise<PlatformAccess> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_platform_access");
  if (error) return "none";
  return data === "verified" || data === "needs_mfa" ? data : "none";
}
