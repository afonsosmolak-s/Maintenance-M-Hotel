import { z } from "zod";
import { WORK_ORDER_PRIORITIES } from "@/lib/domain/work-orders";

export const OPEN_STATUSES = ["pending", "assigned", "in_progress", "on_hold"] as const;
export const DISPLAY_LAYOUTS = { urgent_rotation: "Urgentes fixas + rotação", list: "Lista única paginada" } as const;

/** Configuração de um painel. Valores em falta = predefinições (mostrar tudo). */
export const displayConfigSchema = z.object({
  sectorIds: z.array(z.uuid()).max(100).default([]),
  priorities: z.array(z.enum(WORK_ORDER_PRIORITIES)).min(1, { error: "Escolha pelo menos uma prioridade." }).default([...WORK_ORDER_PRIORITIES]),
  statuses: z.array(z.enum(OPEN_STATUSES)).min(1, { error: "Escolha pelo menos um estado." }).default([...OPEN_STATUSES]),
  showAssignee: z.boolean().default(true),
  showEstablishment: z.boolean().default(true),
  layout: z.enum(["urgent_rotation", "list"]).default("urgent_rotation"),
  rotationSeconds: z.number().int().min(6).max(60).default(12),
});
export type DisplayConfig = z.infer<typeof displayConfigSchema>;

export function parseDisplayConfig(value: unknown): DisplayConfig {
  const parsed = displayConfigSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : displayConfigSchema.parse({});
}

/** Dados que a TV recebe (espelho de public.display_feed). */
export type DisplayFeed = {
  establishment: string | null;
  display: string;
  layout: "urgent_rotation" | "list";
  rotationSeconds: number;
  counts: { critical: number; overdue: number; inProgress: number; pending: number; onHold: number; total: number };
  items: DisplayItem[];
  generatedAt: string;
};

export type DisplayItem = {
  number: number;
  title: string;
  priority: (typeof WORK_ORDER_PRIORITIES)[number];
  status: (typeof OPEN_STATUSES)[number];
  openedAt: string;
  dueAt: string | null;
  overdue: boolean;
  preventive: boolean;
  location: string | null;
  assignee: string | null;
};

/** Divide a lista em "urgente" (crítica ou atrasada, sempre visível) e o resto (em rotação). */
export function splitUrgent(items: DisplayItem[]): { urgent: DisplayItem[]; rest: DisplayItem[] } {
  const urgent: DisplayItem[] = [];
  const rest: DisplayItem[] = [];
  for (const item of items) (item.priority === "critical" || item.overdue ? urgent : rest).push(item);
  return { urgent, rest };
}

export function paginate<T>(items: T[], perPage: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages;
}
