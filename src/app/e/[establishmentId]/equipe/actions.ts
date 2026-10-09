"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/ui/form-message";
import { ensureInvitedUser } from "@/lib/auth/invite";
import { emailSchema, fullNameSchema } from "@/lib/auth/schemas";
import { requireEstablishment } from "@/lib/auth/session";
import { isPermission } from "@/lib/domain/permissions";
import { friendlyDbError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = z.uuid({ error: "Identificador inválido." });

async function authorize(establishmentId: string) {
  const { can } = await requireEstablishment(establishmentId);
  if (!can("members.manage")) return null;
  return createSupabaseServerClient();
}

function done(establishmentId: string, success: string): FormState {
  revalidatePath(`/e/${establishmentId}/equipe`);
  return { success };
}

const inviteSchema = z.object({ email: emailSchema, fullName: fullNameSchema, roleId: uuid });

export async function inviteMember(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("full_name"),
    roleId: formData.get("role_id"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await authorize(establishmentId);
  if (!supabase) return { error: "Sem permissão para gerir a equipe." };

  // O cargo tem de ser deste estabelecimento (a RLS só devolve cargos visíveis ao utilizador).
  const { data: role } = await supabase
    .from("roles")
    .select("id")
    .eq("id", parsed.data.roleId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (!role) return { error: "Cargo inválido." };

  let userId: string;
  let invited: boolean;
  try {
    ({ userId, invited } = await ensureInvitedUser(parsed.data.email, parsed.data.fullName));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível convidar." };
  }

  const { error } = await supabase.rpc("add_member", {
    p_establishment_id: establishmentId,
    p_user_id: userId,
    p_role_id: parsed.data.roleId,
  });
  if (error?.code === "23505") return { error: "Essa pessoa já faz parte da equipe." };
  if (error) return { error: friendlyDbError(error, "Não foi possível adicionar à equipe.") };

  return done(
    establishmentId,
    invited ? `Convite enviado para ${parsed.data.email}.` : `${parsed.data.email} já tinha conta e foi adicionado à equipe.`,
  );
}

/** Ações sobre um membro: trocar cargo, suspender, reativar, remover. */
export async function memberAction(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const membershipId = uuid.safeParse(formData.get("membership_id"));
  if (!membershipId.success) return { error: "Membro inválido." };

  const supabase = await authorize(establishmentId);
  if (!supabase) return { error: "Sem permissão para gerir a equipe." };

  const memberships = () => supabase.from("memberships");
  const id = membershipId.data;
  let result: { error: { code: string; message: string } | null };

  switch (formData.get("intent")) {
    case "change_role": {
      const roleId = uuid.safeParse(formData.get("role_id"));
      if (!roleId.success) return { error: "Cargo inválido." };
      result = await memberships().update({ role_id: roleId.data }).eq("id", id).eq("establishment_id", establishmentId);
      break;
    }
    case "suspend":
      result = await memberships().update({ status: "suspended" }).eq("id", id).eq("establishment_id", establishmentId);
      break;
    case "reactivate":
      result = await memberships().update({ status: "active" }).eq("id", id).eq("establishment_id", establishmentId);
      break;
    case "remove":
      result = await memberships().delete().eq("id", id).eq("establishment_id", establishmentId);
      break;
    default:
      return { error: "Ação inválida." };
  }

  if (result.error) return { error: friendlyDbError(result.error, "Não foi possível atualizar o membro.") };
  return done(establishmentId, "Equipe atualizada.");
}

const roleSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, { error: "Dê um nome ao cargo." }).max(60, { error: "Nome muito longo." }),
  permissions: z.array(z.string().refine(isPermission, { error: "Permissão inválida." })),
});

export async function saveRole(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = roleSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await authorize(establishmentId);
  if (!supabase) return { error: "Sem permissão para gerir cargos." };

  const { id, name, permissions } = parsed.data;
  const { error } = id
    ? await supabase.from("roles").update({ name, permissions }).eq("id", id).eq("establishment_id", establishmentId)
    : await supabase.from("roles").insert({ establishment_id: establishmentId, name, permissions });

  if (error?.code === "23505") return { error: "Já existe um cargo com esse nome." };
  if (error) return { error: friendlyDbError(error, "Não foi possível guardar o cargo.") };
  return done(establishmentId, id ? "Cargo atualizado." : "Cargo criado.");
}

export async function deleteRole(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const roleId = uuid.safeParse(formData.get("id"));
  if (!roleId.success) return { error: "Cargo inválido." };

  const supabase = await authorize(establishmentId);
  if (!supabase) return { error: "Sem permissão para gerir cargos." };

  const { error } = await supabase.from("roles").delete().eq("id", roleId.data).eq("establishment_id", establishmentId);
  if (error?.code === "23503") return { error: "Há pessoas com este cargo. Mude o cargo delas antes de apagar." };
  if (error) return { error: friendlyDbError(error, "Não foi possível apagar o cargo.") };
  return done(establishmentId, "Cargo apagado.");
}
