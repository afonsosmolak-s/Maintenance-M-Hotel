import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type InputProps = ComponentProps<"input"> & { label: string; hint?: string; error?: string };

export function Input({ label, hint, error, className, id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-xs font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-10 rounded-[var(--radius-control)] border bg-paper px-3 text-sm text-ink placeholder:text-muted",
          "transition-colors duration-150 ease-[var(--ease-brand)] focus:border-ink",
          error ? "border-critical" : "border-line",
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-critical">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
