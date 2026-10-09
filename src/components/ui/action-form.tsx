"use client";

import { useActionState, type ReactNode } from "react";
import { FormMessage, type FormState } from "./form-message";

/**
 * Formulário ligado a uma Server Action que devolve FormState; mostra o resultado logo abaixo.
 * Permite páginas em Server Components com formulários simples, sem um componente cliente por formulário.
 */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    // Sem className, empilha; com className, o layout é todo de quem chama (sem classes em conflito).
    <form action={formAction} className={className ?? "flex flex-col gap-3"}>
      {children}
      <FormMessage state={state} className="col-span-full basis-full" />
    </form>
  );
}
