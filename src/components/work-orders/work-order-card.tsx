import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatElapsed, type WorkOrderPriority, type WorkOrderStatus } from "@/lib/domain/work-orders";
import { OverdueBadge, PriorityIndicator, StatusBadge } from "./indicators";

export type WorkOrderCardData = {
  number: number;
  title: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  overdue: boolean;
  openedAt: Date;
  locationLabel: string;
  assigneeName?: string;
  preventive?: boolean;
};

/** Linha de ocorrência em listas: local primeiro (é o que a equipe procura), depois o problema. */
export function WorkOrderCard({ href, data, now }: { href: string; data: WorkOrderCardData; now: Date }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-2 border-l-2 py-4 pl-4 pr-2 transition-colors hover:bg-surface",
        data.priority === "critical" ? "border-critical" : data.overdue ? "border-overdue" : "border-transparent",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-xs font-semibold text-muted">
            #{String(data.number).padStart(4, "0")} · {data.locationLabel}
          </span>
          <span className="text-base font-[550] tracking-[-0.01em]">{data.title}</span>
        </div>
        <span className="shrink-0 text-sm">
          <PriorityIndicator priority={data.priority} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <StatusBadge status={data.status} />
        {data.overdue ? <OverdueBadge /> : null}
        {data.preventive ? <span className="rounded-[var(--radius-control)] border border-line px-2 py-0.5 font-semibold">Preventiva</span> : null}
        <span>{data.assigneeName ? data.assigneeName : "Sem responsável"}</span>
        <span aria-hidden>·</span>
        <span>{formatElapsed(data.openedAt, now)}</span>
      </div>
    </Link>
  );
}
