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

/** Transições permitidas. A mesma tabela será aplicada no banco (função de transição). */
export const STATUS_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  pending: ["assigned", "in_progress", "cancelled"],
  assigned: ["pending", "in_progress", "cancelled"],
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
