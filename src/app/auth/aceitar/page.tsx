"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { completeInvite } from "../actions";

type Status = "checking" | "ready" | "invalid";

/**
 * Destino do e-mail de convite. O Supabase devolve a sessão no fragmento (#access_token=…),
 * que só existe no navegador: guardamos a sessão em cookie e limpamos o endereço.
 */
export default function AcceptInvitePage() {
  const [status, setStatus] = useState<Status>("checking");
  const [state, action] = useActionState(completeInvite, null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    window.history.replaceState(null, "", window.location.pathname);

    const establish = accessToken && refreshToken
      ? supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => !error)
      : supabase.auth.getSession().then(({ data }) => Boolean(data.session));

    establish.then((ok) => setStatus(ok ? "ready" : "invalid"));
  }, []);

  if (status === "checking") {
    return (
      <AuthShell title="Aceitar convite">
        <p className="text-sm text-muted" role="status">
          Verificando o convite…
        </p>
      </AuthShell>
    );
  }

  if (status === "invalid") {
    return (
      <AuthShell title="Convite inválido" description="O link expirou ou já foi usado. Peça um novo convite a quem o enviou.">
        <Link href="/entrar" className="text-sm underline underline-offset-4">
          Ir para o login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Bem-vindo" description="Complete o seu acesso. A senha precisa de pelo menos 10 caracteres.">
      <form action={action} className="flex flex-col gap-4">
        <Input label="Seu nome" name="full_name" autoComplete="name" required autoFocus />
        <Input label="Senha" name="password" type="password" autoComplete="new-password" required />
        <Input label="Repita a senha" name="confirm" type="password" autoComplete="new-password" required />
        <FormMessage state={state} />
        <SubmitButton size="lg" pendingLabel="Guardando…">
          Entrar no sistema
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
