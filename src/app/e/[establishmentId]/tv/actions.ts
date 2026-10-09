"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/ui/form-message";
import { authorizeAction } from "@/lib/auth/authorize";
import { displayConfigSchema } from "@/lib/display/config";
import { friendlyDbError } from "@/lib/supabase/errors";

const NO_PERMISSION: FormState = { error: "Sem permissão para gerir TVs." };

function refresh(establishmentId: string) {
  revalidatePath(`/e/${establishmentId}/tv`);
}

export async function saveDisplay(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()).safeParse(formData.get("id"));
  const name = z.string().trim().min(2, { error: "Dê um nome ao painel." }).max(60).safeParse(formData.get("name"));
  if (!id.success || !name.success) return { error: name.success ? "Pedido inválido." : name.error.issues[0]?.message };

  const config = displayConfigSchema.safeParse({
    sectorIds: formData.getAll("sector_ids").map(String),
    priorities: formData.getAll("priorities").map(String),
    statuses: formData.getAll("statuses").map(String),
    showAssignee: formData.get("show_assignee") === "on",
    showEstablishment: formData.get("show_establishment") === "on",
    layout: formData.get("layout"),
    rotationSeconds: Number(formData.get("rotation_seconds")),
  });
  if (!config.success) return { error: config.error.issues[0]?.message ?? "Configuração inválida." };

  const supabase = await authorizeAction(establishmentId, "displays.manage");
  if (!supabase) return NO_PERMISSION;

  const values = { name: name.data, config: config.data };
  const { error } = id.data
    ? await supabase.from("displays").update(values).eq("id", id.data).eq("establishment_id", establishmentId)
    : await supabase.from("displays").insert({ ...values, establishment_id: establishmentId });
  if (error) return { error: friendlyDbError(error, "Não foi possível guardar o painel.") };

  refresh(establishmentId);
  return { success: id.data ? "Painel atualizado. As TVs recebem a mudança na próxima atualização." : "Painel criado." };
}

export async function displayAction(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Painel inválido." };
  const supabase = await authorizeAction(establishmentId, "displays.manage");
  if (!supabase) return NO_PERMISSION;

  const displays = () => supabase.from("displays");
  let result: { error: { code: string; message: string } | null };
  switch (formData.get("intent")) {
    case "deactivate":
      result = await displays().update({ active: false }).eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    case "activate":
      result = await displays().update({ active: true }).eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    case "delete":
      result = await displays().delete().eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    default:
      return { error: "Ação inválida." };
  }
  if (result.error) return { error: friendlyDbError(result.error, "Não foi possível atualizar o painel.") };
  refresh(establishmentId);
  return { success: "Painel atualizado." };
}

export async function pairTv(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      code: z.string().trim().min(6, { error: "Digite o código de 6 caracteres que aparece na TV." }).max(12),
      displayId: z.uuid({ error: "Escolha o painel." }),
      name: z.string().trim().min(2, { error: "Dê um nome à TV (ex.: TV da manutenção)." }).max(60),
    })
    .safeParse({ code: formData.get("code"), displayId: formData.get("display_id"), name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await authorizeAction(establishmentId, "displays.manage");
  if (!supabase) return NO_PERMISSION;

  const { error } = await supabase.rpc("claim_display_pairing", {
    p_establishment_id: establishmentId,
    p_code: parsed.data.code,
    p_display_id: parsed.data.displayId,
    p_device_name: parsed.data.name,
  });
  if (error) return { error: friendlyDbError(error, "Não foi possível parear.") };

  refresh(establishmentId);
  return { success: "TV pareada. Ela mostra o painel em poucos segundos." };
}

export async function revokeTv(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "TV inválida." };
  const supabase = await authorizeAction(establishmentId, "displays.manage");
  if (!supabase) return NO_PERMISSION;

  const { error } = await supabase.rpc("revoke_display_device", { p_device_id: id.data });
  if (error) return { error: friendlyDbError(error, "Não foi possível revogar.") };
  refresh(establishmentId);
  return { success: "Acesso revogado. A TV volta ao ecrã de pareamento." };
}
