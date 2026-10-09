"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/ui/form-message";
import { authorizeAction } from "@/lib/auth/authorize";
import { friendlyDbError } from "@/lib/supabase/errors";

const uuid = z.uuid({ error: "Identificador inválido." });
const optionalUuid = z.preprocess((v) => (v === "" || v == null ? null : v), uuid.nullable());
const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max).nullable());

const NO_PERMISSION: FormState = { error: "Sem permissão para alterar as configurações." };

function refresh(establishmentId: string, success: string): FormState {
  revalidatePath(`/e/${establishmentId}/configuracoes`, "layout");
  revalidatePath(`/e/${establishmentId}/equipamentos`, "layout");
  return { success };
}

export async function applyTemplate(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const template = z.enum(["motel", "hotel", "blank"]).safeParse(formData.get("template"));
  if (!template.success) return { error: "Escolha um modelo." };

  const supabase = await authorizeAction(establishmentId, "settings.manage");
  if (!supabase) return NO_PERMISSION;

  const { error } = await supabase.rpc("apply_establishment_template", {
    p_establishment_id: establishmentId,
    p_template: template.data,
  });
  if (error) return { error: friendlyDbError(error, "Não foi possível aplicar o modelo.") };
  return refresh(establishmentId, "Modelo aplicado. Ajuste o que precisar.");
}

// ---------------------------------------------------------------- locais

const locationSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1, { error: "Dê um nome ao local." }).max(80, { error: "Nome muito longo." }),
  parentId: optionalUuid,
  locationTypeId: optionalUuid,
  code: optionalText(20),
});

export async function saveLocation(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = locationSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    parentId: formData.get("parent_id"),
    locationTypeId: formData.get("location_type_id"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await authorizeAction(establishmentId, "settings.manage");
  if (!supabase) return NO_PERMISSION;

  const { id, name, parentId, locationTypeId, code } = parsed.data;
  const values = { name, parent_id: parentId, location_type_id: locationTypeId, code };
  const { error } = id
    ? await supabase.from("locations").update(values).eq("id", id).eq("establishment_id", establishmentId)
    : await supabase.from("locations").insert({ ...values, establishment_id: establishmentId });

  if (error?.code === "23505") return { error: "Já existe um local com esse nome no mesmo nível." };
  if (error) return { error: friendlyDbError(error, "Não foi possível guardar o local.") };
  return refresh(establishmentId, id ? "Local atualizado." : `${name} adicionado.`);
}

export async function locationAction(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "Local inválido." };

  const supabase = await authorizeAction(establishmentId, "settings.manage");
  if (!supabase) return NO_PERMISSION;

  const locations = () => supabase.from("locations");
  let result: { error: { code: string; message: string } | null };
  switch (formData.get("intent")) {
    case "deactivate":
      result = await locations().update({ active: false }).eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    case "activate":
      result = await locations().update({ active: true }).eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    case "delete":
      result = await locations().delete().eq("id", id.data).eq("establishment_id", establishmentId);
      if (result.error?.code === "23503") {
        return { error: "Este local tem locais dentro dele ou equipamentos. Desative-o em vez de excluir." };
      }
      break;
    default:
      return { error: "Ação inválida." };
  }

  if (result.error) return { error: friendlyDbError(result.error, "Não foi possível atualizar o local.") };
  return refresh(establishmentId, "Local atualizado.");
}

// --------------------------------------------------------- tipos de local

const namedSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(2, { error: "Nome muito curto." }).max(40, { error: "Nome muito longo." }),
});

export async function saveLocationType(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = namedSchema.safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await authorizeAction(establishmentId, "settings.manage");
  if (!supabase) return NO_PERMISSION;

  const { id, name } = parsed.data;
  const { error } = id
    ? await supabase.from("location_types").update({ name }).eq("id", id).eq("establishment_id", establishmentId)
    : await supabase.from("location_types").insert({ establishment_id: establishmentId, name });

  if (error?.code === "23505") return { error: "Esse tipo já existe." };
  if (error) return { error: friendlyDbError(error, "Não foi possível guardar o tipo.") };
  return refresh(establishmentId, id ? "Tipo atualizado." : "Tipo criado.");
}

export async function deleteLocationType(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "Tipo inválido." };

  const supabase = await authorizeAction(establishmentId, "settings.manage");
  if (!supabase) return NO_PERMISSION;

  const { error } = await supabase.from("location_types").delete().eq("id", id.data).eq("establishment_id", establishmentId);
  if (error?.code === "23503") return { error: "Há locais com este tipo. Mude-os antes de apagar." };
  if (error) return { error: friendlyDbError(error, "Não foi possível apagar o tipo.") };
  return refresh(establishmentId, "Tipo apagado.");
}

// ------------------------------------------------------------- categorias

export async function saveCategory(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = namedSchema.safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await authorizeAction(establishmentId, "settings.manage");
  if (!supabase) return NO_PERMISSION;

  const { id, name } = parsed.data;
  const { error } = id
    ? await supabase.from("categories").update({ name }).eq("id", id).eq("establishment_id", establishmentId)
    : await supabase.from("categories").insert({ establishment_id: establishmentId, name });

  if (error?.code === "23505") return { error: "Essa categoria já existe." };
  if (error) return { error: friendlyDbError(error, "Não foi possível guardar a categoria.") };
  return refresh(establishmentId, id ? "Categoria atualizada." : "Categoria criada.");
}

export async function categoryAction(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { error: "Categoria inválida." };

  const supabase = await authorizeAction(establishmentId, "settings.manage");
  if (!supabase) return NO_PERMISSION;

  const categories = () => supabase.from("categories");
  let result: { error: { code: string; message: string } | null };
  switch (formData.get("intent")) {
    case "deactivate":
      result = await categories().update({ active: false }).eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    case "activate":
      result = await categories().update({ active: true }).eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    case "delete":
      result = await categories().delete().eq("id", id.data).eq("establishment_id", establishmentId);
      if (result.error?.code === "23503") return { error: "Há equipamentos nesta categoria. Desative-a em vez de excluir." };
      break;
    default:
      return { error: "Ação inválida." };
  }

  if (result.error) return { error: friendlyDbError(result.error, "Não foi possível atualizar a categoria.") };
  return refresh(establishmentId, "Categoria atualizada.");
}
