"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/ui/form-message";
import { authorizeAction } from "@/lib/auth/authorize";
import { INTERVAL_UNITS } from "@/lib/domain/preventive";
import { WORK_ORDER_PRIORITIES } from "@/lib/domain/work-orders";
import { friendlyDbError } from "@/lib/supabase/errors";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const NO_PERMISSION: FormState = { error: "Sem permissão para gerir preventivas." };

const planSchema = z.object({
  id: z.preprocess(emptyToNull, z.uuid().nullable()),
  title: z.string().trim().min(3, { error: "Dê um nome à tarefa." }).max(120),
  description: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable()),
  locationId: z.uuid({ error: "Escolha o local." }),
  assetId: z.preprocess(emptyToNull, z.uuid().nullable()),
  categoryId: z.preprocess(emptyToNull, z.uuid().nullable()),
  priority: z.enum(WORK_ORDER_PRIORITIES),
  assigneeId: z.preprocess(emptyToNull, z.uuid().nullable()),
  intervalUnit: z.enum(INTERVAL_UNITS, { error: "Escolha a periodicidade." }),
  intervalCount: z.coerce.number().int().min(1, { error: "Periodicidade inválida." }).max(365),
  nextDueOn: z.iso.date({ error: "Informe a próxima data." }),
  leadDays: z.coerce.number().int().min(0).max(60, { error: "Antecedência máxima de 60 dias." }),
});

function refresh(establishmentId: string) {
  revalidatePath(`/e/${establishmentId}`, "layout");
}

export async function savePlan(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = planSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description"),
    locationId: formData.get("location_id"),
    assetId: formData.get("asset_id"),
    categoryId: formData.get("category_id"),
    priority: formData.get("priority"),
    assigneeId: formData.get("assignee_id"),
    intervalUnit: formData.get("interval_unit"),
    intervalCount: formData.get("interval_count"),
    nextDueOn: formData.get("next_due_on"),
    leadDays: formData.get("lead_days"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await authorizeAction(establishmentId, "preventive.manage");
  if (!supabase) return NO_PERMISSION;

  const p = parsed.data;
  const values = {
    title: p.title,
    description: p.description,
    location_id: p.locationId,
    asset_id: p.assetId,
    category_id: p.categoryId,
    priority: p.priority,
    assignee_id: p.assigneeId,
    interval_unit: p.intervalUnit,
    interval_count: p.intervalCount,
    next_due_on: p.nextDueOn,
    lead_days: p.leadDays,
  };
  const { error } = p.id
    ? await supabase.from("preventive_plans").update(values).eq("id", p.id).eq("establishment_id", establishmentId)
    : await supabase.from("preventive_plans").insert({ ...values, establishment_id: establishmentId });
  if (error) return { error: friendlyDbError(error, "Não foi possível guardar o plano.") };

  refresh(establishmentId);
  return { success: p.id ? "Plano atualizado." : "Plano criado. A ordem é gerada automaticamente dentro da antecedência." };
}

export async function planAction(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Plano inválido." };

  const supabase = await authorizeAction(establishmentId, "preventive.manage");
  if (!supabase) return NO_PERMISSION;

  const plans = () => supabase.from("preventive_plans");
  let result: { error: { code: string; message: string } | null };
  switch (formData.get("intent")) {
    case "pause":
      result = await plans().update({ active: false }).eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    case "resume":
      result = await plans().update({ active: true }).eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    case "delete":
      result = await plans().delete().eq("id", id.data).eq("establishment_id", establishmentId);
      break;
    default:
      return { error: "Ação inválida." };
  }
  if (result.error) return { error: friendlyDbError(result.error, "Não foi possível atualizar o plano.") };

  refresh(establishmentId);
  return { success: "Plano atualizado." };
}

export async function generateNow(establishmentId: string): Promise<FormState> {
  const supabase = await authorizeAction(establishmentId, "preventive.manage");
  if (!supabase) return NO_PERMISSION;

  const { data, error } = await supabase.rpc("run_preventive_generation", { p_establishment_id: establishmentId });
  if (error) return { error: friendlyDbError(error, "Não foi possível gerar as ordens.") };

  refresh(establishmentId);
  return {
    success: data
      ? `${data} ordem(ns) preventiva(s) gerada(s). Estão em Ocorrências.`
      : "Nenhuma ordem a gerar agora: nada dentro da antecedência ou as anteriores ainda estão abertas.",
  };
}
