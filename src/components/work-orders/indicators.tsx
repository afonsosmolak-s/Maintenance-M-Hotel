import { cn } from "@/lib/cn";
import {
  PRIORITY_LABELS,
  PRIORITY_LEVEL,
  STATUS_LABELS,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@/lib/domain/work-orders";

const priorityColor: Record<WorkOrderPriority, string> = {
  critical: "text-critical",
  high: "text-high",
  medium: "text-ink",
  low: "text-muted",
};

/** Prioridade = barras de nível + rótulo + cor. A cor nunca aparece sozinha. */
export function PriorityIndicator({
  priority,
  size = "md",
}: {
  priority: WorkOrderPriority;
  size?: "md" | "xl";
}) {
  const level = PRIORITY_LEVEL[priority];
  const bar = size === "xl" ? "w-[0.35em]" : "w-[3px]";

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold", priorityColor[priority])}>
      <span aria-hidden className="inline-flex h-[0.9em] items-end gap-[2px]">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(bar, "rounded-[1px] bg-current", step > level && "opacity-20")}
            style={{ height: `${25 * step}%` }}
          />
        ))}
      </span>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

const statusStyle: Record<WorkOrderStatus, string> = {
  pending: "bg-surface text-ink",
  assigned: "bg-surface-strong text-ink",
  in_progress: "bg-info-bg text-info",
  on_hold: "bg-waiting-bg text-waiting",
  done: "bg-success-bg text-success",
  cancelled: "bg-surface text-muted line-through",
};

export function StatusBadge({ status, className }: { status: WorkOrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-control)] px-2 py-0.5 text-xs font-semibold",
        statusStyle[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function OverdueBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-overdue-bg px-2 py-0.5 text-xs font-semibold text-overdue",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" />
      </svg>
      Atrasada
    </span>
  );
}
