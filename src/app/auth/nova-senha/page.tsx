"use client";

import { useActionState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updatePassword } from "../actions";

export default function NewPasswordPage() {
  const [state, action] = useActionState(updatePassword, null);

  return (
    <AuthShell title="Nova senha" description="Use pelo menos 10 caracteres.">
      <form action={action} className="flex flex-col gap-4">
        <Input label="Nova senha" name="password" type="password" autoComplete="new-password" required autoFocus />
        <Input label="Repita a senha" name="confirm" type="password" autoComplete="new-password" required />
        <FormMessage state={state} />
        <SubmitButton size="lg" pendingLabel="Guardando…">
          Guardar senha
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
