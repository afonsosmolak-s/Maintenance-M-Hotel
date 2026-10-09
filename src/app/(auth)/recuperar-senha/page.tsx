"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requestPasswordReset } from "../actions";

export default function ResetPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, null);

  return (
    <AuthShell title="Recuperar senha" description="Enviamos um link para você criar uma nova senha.">
      <form action={action} className="flex flex-col gap-4">
        <Input label="E-mail" name="email" type="email" autoComplete="email" required autoFocus />
        <FormMessage state={state} />
        <SubmitButton size="lg" pendingLabel="Enviando…">
          Enviar link
        </SubmitButton>
        <Link href="/entrar" className="text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          Voltar ao login
        </Link>
      </form>
    </AuthShell>
  );
}
