"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/ui/form-message";
import { ensureInvitedUser } from "@/lib/auth/invite";
import { emailSchema, fullNameSchema } from "@/lib/auth/schemas";
import { getPlatformAccess } from "@/lib/auth/session";
import { isValidCnpj, normalizeCnpj } from "@/lib/domain/cnpj";
import { friendlyDbError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const establishmentSchema = z.object({
  name: z.string().trim().min(2, { error: "Informe o nome do estabelecimento." }).max(120),
  legalName: z.string().trim().min(2, { error: "Informe a razão social." }).max(200),
  cnpj: z
    .string()
    .refine(isValidCnpj, { error: "CNPJ inválido. Confira os números (aceita o formato alfanumérico)." })
    .transform(normalizeCnpj),
  kind: z.enum(["motel", "hotel", "other"], { error: "Escolha o tipo." }),
  ownerName: fullNameSchema,
  ownerEmail: emailSchema,
});

export async function createEstablishment(_prev: FormState, formData: FormData): Promise<FormState> {
  if ((await getPlatformAccess()) !== "verified") return { error: "Sessão da plataforma sem verificação em duas etapas." };

  const parsed = establishmentSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legal_name"),
    cnpj: formData.get("cnpj"),
    kind: formData.get("kind"),
    ownerName: formData.get("owner_name"),
    ownerEmail: formData.get("owner_email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const data = parsed.data;

  let ownerId: string;
  let invited: boolean;
  try {
    ({ userId: ownerId, invited } = await ensureInvitedUser(data.ownerEmail, data.ownerName));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível convidar o Proprietário." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_establishment", {
    p_name: data.name,
    p_legal_name: data.legalName,
    p_cnpj: data.cnpj,
    p_kind: data.kind,
    p_owner_user_id: ownerId,
  });
  if (error?.code === "23505") return { error: "Já existe um estabelecimento com este CNPJ." };
  if (error) return { error: friendlyDbError(error, "Não foi possível cadastrar o estabelecimento.") };

  revalidatePath("/plataforma");
  return {
    success: invited
      ? `${data.name} cadastrado. Convite enviado para ${data.ownerEmail}.`
      : `${data.name} cadastrado. ${data.ownerEmail} já tinha conta e passa a ser o Proprietário.`,
  };
}

export async function setEstablishmentStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  if ((await getPlatformAccess()) !== "verified") return { error: "Sessão da plataforma sem verificação em duas etapas." };

  const parsed = z
    .object({ id: z.uuid(), status: z.enum(["active", "suspended"]) })
    .safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return { error: "Pedido inválido." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_establishment_status", {
    p_establishment_id: parsed.data.id,
    p_status: parsed.data.status,
  });
  if (error) return { error: friendlyDbError(error, "Não foi possível alterar a conta.") };

  revalidatePath("/plataforma");
  return { success: parsed.data.status === "suspended" ? "Conta suspensa." : "Conta reativada." };
}
