"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/ui/form-message";
import { requireEstablishment } from "@/lib/auth/session";
import { WORK_ORDER_PRIORITIES } from "@/lib/domain/work-orders";
import { friendlyDbError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);
const optionalUuid = z.preprocess(emptyToNull, z.uuid().nullable());
const money = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : Number(v.replace(",", "."))) : v),
  z.number({ error: "Valor inválido." }).min(0, { error: "Valor inválido." }).max(1_000_000).nullable(),
);

function refresh(establishmentId: string, number?: number) {
  revalidatePath(`/e/${establishmentId}`, "layout");
  if (number) revalidatePath(`/e/${establishmentId}/ocorrencias/${number}`);
}

async function client(establishmentId: string) {
  await requireEstablishment(establishmentId);
  return createSupabaseServerClient();
}

// ------------------------------------------------------------------ abrir

const createSchema = z.object({
  title: z.string().trim().min(3, { error: "Descreva o problema em poucas palavras." }).max(120, { error: "Título muito longo." }),
  description: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable()),
  locationId: z.uuid({ error: "Escolha o local." }),
  assetId: optionalUuid,
  categoryId: optionalUuid,
  priority: z.enum(WORK_ORDER_PRIORITIES, { error: "Escolha a prioridade." }),
  assigneeId: optionalUuid,
});

export type CreateWorkOrderResult = { error: string } | { id: string; number: number };

/** Abre a ocorrência. As fotos são enviadas depois pelo navegador, já com o id. */
export async function createWorkOrder(establishmentId: string, input: unknown): Promise<CreateWorkOrderResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await client(establishmentId);
  const d = parsed.data;

  const { data: id, error } = await supabase.rpc("create_work_order", {
    p_establishment_id: establishmentId,
    p_title: d.title,
    p_description: d.description,
    p_location_id: d.locationId,
    p_asset_id: d.assetId,
    p_category_id: d.categoryId,
    p_priority: d.priority,
    p_assignee_id: d.assigneeId,
  });
  if (error) return { error: friendlyDbError(error, "Não foi possível abrir a ocorrência.") };

  const { data: created } = await supabase.from("work_orders").select("number").eq("id", id).single();
  refresh(establishmentId);
  return { id, number: created?.number ?? 0 };
}

// --------------------------------------------------------------- estados

const transitionSchema = z.object({
  id: z.uuid(),
  number: z.coerce.number().int().positive(),
  to: z.enum(["in_progress", "on_hold", "done", "cancelled"]),
  note: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable()),
  laborCost: money.optional(),
});

export async function transitionWorkOrder(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = transitionSchema.safeParse({
    id: formData.get("id"),
    number: formData.get("number"),
    to: formData.get("to"),
    note: formData.get("note"),
    laborCost: formData.get("labor_cost") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await client(establishmentId);

  const { error } = await supabase.rpc("transition_work_order", {
    p_work_order_id: parsed.data.id,
    p_to: parsed.data.to,
    p_note: parsed.data.note,
    p_labor_cost: parsed.data.laborCost ?? null,
  });
  if (error) return { error: friendlyDbError(error, "Não foi possível mudar o estado.") };

  refresh(establishmentId, parsed.data.number);
  const labels = { in_progress: "Serviço em andamento.", on_hold: "Marcado como aguardando.", done: "Ocorrência concluída.", cancelled: "Ocorrência cancelada." };
  return { success: labels[parsed.data.to] };
}

/** Variante para o fluxo com fotos (concluir): o cliente envia as fotos antes e chama esta ação. */
export async function transitionWorkOrderDirect(establishmentId: string, input: unknown): Promise<FormState> {
  const formData = new FormData();
  for (const [key, value] of Object.entries((input ?? {}) as Record<string, unknown>)) {
    if (value !== undefined && value !== null) formData.set(key, String(value));
  }
  return transitionWorkOrder(establishmentId, null, formData);
}

export async function assignWorkOrder(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ id: z.uuid(), number: z.coerce.number().int().positive(), assigneeId: optionalUuid })
    .safeParse({ id: formData.get("id"), number: formData.get("number"), assigneeId: formData.get("assignee_id") });
  if (!parsed.success) return { error: "Pedido inválido." };
  const supabase = await client(establishmentId);

  const { error } = await supabase.rpc("assign_work_order", {
    p_work_order_id: parsed.data.id,
    p_assignee_id: parsed.data.assigneeId,
  });
  if (error) return { error: friendlyDbError(error, "Não foi possível atribuir.") };

  refresh(establishmentId, parsed.data.number);
  return { success: parsed.data.assigneeId ? "Responsável definido." : "Responsável removido." };
}

// --------------------------------------------------------------- edição

const updateSchema = createSchema.omit({ assigneeId: true }).extend({
  id: z.uuid(),
  number: z.coerce.number().int().positive(),
  dueAt: z.preprocess(emptyToNull, z.string().nullable()),
  timezoneOffset: z.coerce.number().int().min(-840).max(840).default(180),
});

export async function updateWorkOrder(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    number: formData.get("number"),
    title: formData.get("title"),
    description: formData.get("description"),
    locationId: formData.get("location_id"),
    assetId: formData.get("asset_id"),
    categoryId: formData.get("category_id"),
    priority: formData.get("priority"),
    dueAt: formData.get("due_at"),
    timezoneOffset: formData.get("tz_offset") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  // <input type="datetime-local"> não tem fuso: aplica o deslocamento do navegador de quem editou.
  let dueAtIso: string | null = null;
  if (d.dueAt) {
    const local = new Date(`${d.dueAt}:00Z`);
    if (Number.isNaN(local.getTime())) return { error: "Prazo inválido." };
    dueAtIso = new Date(local.getTime() + d.timezoneOffset * 60_000).toISOString();
  }

  const supabase = await client(establishmentId);
  const { error } = await supabase.rpc("update_work_order", {
    p_work_order_id: d.id,
    p_title: d.title,
    p_description: d.description,
    p_location_id: d.locationId,
    p_asset_id: d.assetId,
    p_category_id: d.categoryId,
    p_priority: d.priority,
    p_due_at: dueAtIso,
  });
  if (error) return { error: friendlyDbError(error, "Não foi possível guardar as alterações.") };

  refresh(establishmentId, d.number);
  return { success: "Ocorrência atualizada." };
}

// ------------------------------------------------- comentários e materiais

export async function addComment(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      id: z.uuid(),
      number: z.coerce.number().int().positive(),
      body: z.string().trim().min(1, { error: "Escreva a observação." }).max(2000, { error: "Texto muito longo." }),
    })
    .safeParse({ id: formData.get("id"), number: formData.get("number"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await client(establishmentId);
  const { data: claims } = await supabase.auth.getClaims();
  const { error } = await supabase.from("work_order_comments").insert({
    establishment_id: establishmentId,
    work_order_id: parsed.data.id,
    author_id: claims?.claims?.sub ?? "",
    body: parsed.data.body,
  });
  if (error) return { error: friendlyDbError(error, "Não foi possível guardar a observação.") };

  refresh(establishmentId, parsed.data.number);
  return { success: "Observação adicionada." };
}

export async function addItem(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      id: z.uuid(),
      number: z.coerce.number().int().positive(),
      description: z.string().trim().min(2, { error: "Descreva o material." }).max(200),
      quantity: z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v), z.number().positive({ error: "Quantidade inválida." })),
      unitCost: money.optional(),
    })
    .safeParse({
      id: formData.get("id"),
      number: formData.get("number"),
      description: formData.get("description"),
      quantity: formData.get("quantity") || "1",
      unitCost: formData.get("unit_cost") ?? undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await client(establishmentId);
  const { error } = await supabase.rpc("add_work_order_item", {
    p_work_order_id: parsed.data.id,
    p_description: parsed.data.description,
    p_quantity: parsed.data.quantity,
    p_unit_cost: parsed.data.unitCost ?? null,
  });
  if (error) return { error: friendlyDbError(error, "Não foi possível registrar o material.") };

  refresh(establishmentId, parsed.data.number);
  return { success: "Material registrado." };
}

export async function removeItem(establishmentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ itemId: z.uuid(), number: z.coerce.number().int().positive() })
    .safeParse({ itemId: formData.get("item_id"), number: formData.get("number") });
  if (!parsed.success) return { error: "Pedido inválido." };

  const supabase = await client(establishmentId);
  const { error } = await supabase.rpc("remove_work_order_item", { p_item_id: parsed.data.itemId });
  if (error) return { error: friendlyDbError(error, "Não foi possível remover.") };

  refresh(establishmentId, parsed.data.number);
  return { success: "Material removido." };
}

/** Depois de o navegador enviar fotos ao armazenamento: atualiza a página. */
export async function refreshWorkOrder(establishmentId: string, number: number): Promise<void> {
  await requireEstablishment(establishmentId);
  refresh(establishmentId, number);
}
