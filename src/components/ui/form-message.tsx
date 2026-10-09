import { cn } from "@/lib/cn";

export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string> } | null;

/** Mensagem de resultado de um formulário, anunciada a leitores de ecrã. */
export function FormMessage({ state, className }: { state: FormState; className?: string }) {
  if (!state?.error && !state?.success) return null;
  const isError = Boolean(state.error);
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-control)] px-3 py-2 text-sm",
        isError ? "bg-critical-bg text-critical" : "bg-success-bg text-success",
        className,
      )}
    >
      {state.error ?? state.success}
    </p>
  );
}
