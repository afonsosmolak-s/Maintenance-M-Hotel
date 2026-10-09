"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { signIn } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Input label="E-mail" name="email" type="email" autoComplete="email" required autoFocus />
      <Input label="Senha" name="password" type="password" autoComplete="current-password" required />
      <FormMessage state={state} />
      <SubmitButton size="lg" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
      <Link href="/recuperar-senha" className="text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
        Esqueci a senha
      </Link>
    </form>
  );
}
