/**
 * Regras de domínio das ocorrências / ordens de serviço que não dependem de banco.
 * Estados e prioridades são fixos no sistema (decisão D5).
 */

export const WORK_ORDER_STATUSES = [
  "pending",
  "assigned",
  "in_progress",
  "on_hold",
  "done",
  "cancelled",
] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending: "Pendente",
  assigned: "Atribuída",
  in_progress: "Em andamento",
  on_hold: "Aguardando material",
  done: "Concluída",
  cancelled: "Cancelada",
};

export const CLOSED_STATUSES: readonly WorkOrderStatus[] = ["done", "cancelled"];

export function isClosed(status: WorkOrderStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

/**
 * Transições de trabalho (public.transition_work_order, que é quem as aplica).
 * Pendente ↔ Atribuída muda pela atribuição (public.assign_work_order), não por aqui.
 */
export const STATUS_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  pending: ["in_progress", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["on_hold", "done", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  done: [],
  cancelled: [],
};

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export const WORK_ORDER_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type WorkOrderPriority = (typeof WORK_ORDER_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

/** Nível de 1 a 4, usado pelo indicador visual e para ordenar. */
export const PRIORITY_LEVEL: Record<WorkOrderPriority, 1 | 2 | 3 | 4> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** "Atrasada" não é um estado: é calculada a partir do prazo. */
export function isOverdue(
  workOrder: { status: WorkOrderStatus; dueAt: Date | null },
  now: Date,
): boolean {
  if (!workOrder.dueAt || isClosed(workOrder.status)) return false;
  return workOrder.dueAt.getTime() < now.getTime();
}

/** Tempo decorrido em texto curto, para listas e TV: "agora", "há 15 min", "há 3 h", "há 2 d". */
export function formatElapsed(since: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - since.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export function isWorkOrderStatus(value: string): value is WorkOrderStatus {
  return (WORK_ORDER_STATUSES as readonly string[]).includes(value);
}

export function isWorkOrderPriority(value: string): value is WorkOrderPriority {
  return (WORK_ORDER_PRIORITIES as readonly string[]).includes(value);
}

/** Ordem de urgência para listas e TV: prioridade, depois atrasadas, depois prazo mais próximo, depois mais antigas. */
export function compareByUrgency(
  a: { priority: WorkOrderPriority; status: WorkOrderStatus; dueAt: Date | null; openedAt: Date },
  b: { priority: WorkOrderPriority; status: WorkOrderStatus; dueAt: Date | null; openedAt: Date },
  now: Date,
): number {
  const byPriority = PRIORITY_LEVEL[b.priority] - PRIORITY_LEVEL[a.priority];
  if (byPriority !== 0) return byPriority;
  const byOverdue = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
  if (byOverdue !== 0) return byOverdue;
  const dueA = a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const dueB = b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (dueA !== dueB) return dueA - dueB;
  return a.openedAt.getTime() - b.openedAt.getTime();
}
