"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/ui/form-message";
import { authorizeAction } from "@/lib/auth/authorize";
import { ASSET_STATUSES } from "@/lib/domain/assets";
import { friendlyDbError } from "@/lib/supabase/errors";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max, { error: "Texto muito longo." }).nullable());
const optionalDate = z.preprocess(emptyToNull, z.iso.date({ error: "Data inválida." }).nullable());

const assetSchema = z
  .object({
    id: z.preprocess(emptyToNull, z.uuid().nullable()),
    name: z.string().trim().min(2, { error: "Dê um nome ao equipamento." }).max(80, { error: "Nome muito longo." }),
    locationId: z.uuid({ error: "Escolha onde o equipamento fica." }),
    categoryId: z.preprocess(emptyToNull, z.uuid().nullable()),
    internalCode: optionalText(30),
    manufacturer: optionalText(60),
    model: optionalText(60),
    installedOn: optionalDate,
    warrantyUntil: optionalDate,
    status: z.enum(ASSET_STATUSES, { error: "Estado inválido." }),
    notes: optionalText(2000),
  })
  .refine((a) => !a.installedOn || !a.warrantyUntil || a.warrantyUntil >= a.installedOn, {
    error: "A garantia não pode terminar antes da instalação.",
    path: ["warrantyUntil"],
  });

export async function saveAsset(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = assetSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    locationId: formData.get("location_id"),
    categoryId: formData.get("category_id"),
    internalCode: formData.get("internal_code"),
    manufacturer: formData.get("manufacturer"),
    model: formData.get("model"),
    installedOn: formData.get("installed_on"),
    warrantyUntil: formData.get("warranty_until"),
    status: formData.get("operational_status"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await authorizeAction(establishmentId, "assets.manage");
  if (!supabase) return { error: "Sem permissão para gerir equipamentos." };

  const a = parsed.data;
  const values = {
    name: a.name,
    location_id: a.locationId,
    category_id: a.categoryId,
    internal_code: a.internalCode,
    manufacturer: a.manufacturer,
    model: a.model,
    installed_on: a.installedOn,
    warranty_until: a.warrantyUntil,
    operational_status: a.status,
    notes: a.notes,
  };

  const { error } = a.id
    ? await supabase.from("assets").update(values).eq("id", a.id).eq("establishment_id", establishmentId)
    : await supabase.from("assets").insert({ ...values, establishment_id: establishmentId });

  if (error?.code === "23505") return { error: "Já existe um equipamento com esse código interno." };
  if (error?.code === "23503") return { error: "Local ou categoria inválidos." };
  if (error) return { error: friendlyDbError(error, "Não foi possível guardar o equipamento.") };

  revalidatePath(`/e/${establishmentId}/equipamentos`, "layout");
  if (!a.id) redirect(`/e/${establishmentId}/equipamentos`);
  return { success: "Equipamento atualizado." };
}

export async function deleteAsset(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Equipamento inválido." };

  const supabase = await authorizeAction(establishmentId, "assets.manage");
  if (!supabase) return { error: "Sem permissão para gerir equipamentos." };

  const { error } = await supabase.from("assets").delete().eq("id", id.data).eq("establishment_id", establishmentId);
  if (error?.code === "23503") return { error: "Este equipamento tem histórico. Marque-o como Desativado em vez de excluir." };
  if (error) return { error: friendlyDbError(error, "Não foi possível excluir o equipamento.") };

  revalidatePath(`/e/${establishmentId}/equipamentos`, "layout");
  redirect(`/e/${establishmentId}/equipamentos`);
}
