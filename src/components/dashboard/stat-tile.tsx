import Link from "next/link";
import { cn } from "@/lib/cn";

/** Um número de destaque. Cor só quando há algo a sinalizar (tone), e sempre com o rótulo ao lado. */
export function StatTile({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "critical" | "overdue";
}) {
  const body = (
    <>
      <span
        className={cn(
          "text-3xl font-[550] tabular-nums tracking-[-0.03em]",
          tone === "critical" && "text-critical",
          tone === "overdue" && "text-overdue",
        )}
      >
        {value}
      </span>
      <span className="text-xs font-semibold text-ink">{label}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </>
  );
  const className = "flex min-h-28 flex-col gap-1 bg-paper p-4";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:bg-surface")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function StatGrid({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-control)] border border-line bg-line sm:grid-cols-3 lg:grid-cols-6"
    >
      {children}
    </div>
  );
}
