import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type SelectProps = ComponentProps<"select"> & { label: string; hint?: string };

export function Select({ label, hint, className, id, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={selectId} className="text-xs font-semibold text-ink">
        {label}
      </label>
      <select
        id={selectId}
        aria-describedby={hint ? `${selectId}-hint` : undefined}
        className="h-10 rounded-[var(--radius-control)] border border-line bg-paper px-3 text-sm text-ink transition-colors duration-150 focus:border-ink"
        {...props}
      >
        {children}
      </select>
      {hint ? (
        <p id={`${selectId}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
