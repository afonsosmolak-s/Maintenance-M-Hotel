import "server-only";
import { isOverdue, isWorkOrderPriority, isWorkOrderStatus, type WorkOrderPriority, type WorkOrderStatus } from "@/lib/domain/work-orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TeamMember = { id: string; name: string; canExecute: boolean };

/** Membros ativos do estabelecimento (nomes para listas; canExecute = pode receber serviços). */
export async function loadTeam(establishmentId: string): Promise<TeamMember[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: memberships }, { data: roles }] = await Promise.all([
    supabase.from("memberships").select("user_id, role_id, status, profiles(full_name, email)").eq("establishment_id", establishmentId),
    supabase.from("roles").select("id, permissions").eq("establishment_id", establishmentId),
  ]);
  const executes = new Set((roles ?? []).filter((r) => r.permissions.includes("work_orders.execute")).map((r) => r.id));

  return (memberships ?? [])
    .filter((m) => m.status === "active")
    .map((m) => ({
      id: m.user_id,
      name: m.profiles?.full_name || m.profiles?.email || "Sem nome",
      canExecute: executes.has(m.role_id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export type WorkOrderSummary = {
  id: string;
  number: number;
  title: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  locationId: string;
  assigneeId: string | null;
  reportedBy: string;
  openedAt: Date;
  dueAt: Date | null;
  completedAt: Date | null;
  overdue: boolean;
};

export const VIEWS = {
  abertas: "Abertas",
  minhas: "Minhas",
  "sem-responsavel": "Sem responsável",
  atrasadas: "Atrasadas",
  concluidas: "Concluídas",
  canceladas: "Canceladas",
} as const;
export type View = keyof typeof VIEWS;

export function isView(value: unknown): value is View {
  return typeof value === "string" && value in VIEWS;
}

export async function loadWorkOrders(
  establishmentId: string,
  options: { view: View; userId: string; sectorLocationIds?: string[]; priority?: WorkOrderPriority; assigneeId?: string },
): Promise<WorkOrderSummary[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("work_orders")
    .select("id, number, title, status, priority, location_id, assignee_id, reported_by, opened_at, due_at, completed_at")
    .eq("establishment_id", establishmentId);

  const open = ["pending", "assigned", "in_progress", "on_hold"];
  switch (options.view) {
    case "abertas":
    case "atrasadas":
      query = query.in("status", open);
      break;
    case "minhas":
      query = query.in("status", open).eq("assignee_id", options.userId);
      break;
    case "sem-responsavel":
      query = query.in("status", open).is("assignee_id", null);
      break;
    case "concluidas":
      query = query.eq("status", "done").order("completed_at", { ascending: false }).limit(100);
      break;
    case "canceladas":
      query = query.eq("status", "cancelled").order("cancelled_at", { ascending: false }).limit(100);
      break;
  }
  if (options.priority) query = query.eq("priority", options.priority);
  if (options.assigneeId) query = query.eq("assignee_id", options.assigneeId);
  if (options.sectorLocationIds) query = query.in("location_id", options.sectorLocationIds);

  const { data, error } = await query;
  if (error) throw new Error("Não foi possível carregar as ocorrências.");

  const now = new Date();
  const rows = data
    .filter((w) => isWorkOrderStatus(w.status) && isWorkOrderPriority(w.priority))
    .map((w) => {
      const status = w.status as WorkOrderStatus;
      const dueAt = w.due_at ? new Date(w.due_at) : null;
      return {
        id: w.id,
        number: w.number,
        title: w.title,
        status,
        priority: w.priority as WorkOrderPriority,
        locationId: w.location_id,
        assigneeId: w.assignee_id,
        reportedBy: w.reported_by,
        openedAt: new Date(w.opened_at),
        dueAt,
        completedAt: w.completed_at ? new Date(w.completed_at) : null,
        overdue: isOverdue({ status, dueAt }, now),
      };
    });

  return options.view === "atrasadas" ? rows.filter((w) => w.overdue) : rows;
}
