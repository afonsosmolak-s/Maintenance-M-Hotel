import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNextPath } from "@/lib/auth/redirects";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const LINK_ERRORS: Record<string, string> = {
  link: "O link é inválido ou expirou. Peça um novo.",
};

export default function LoginPage({ searchParams }: PageProps<"/entrar">) {
  return (
    <AuthShell title="Entrar" description="Acesso para gestão e equipe de manutenção.">
      <Suspense fallback={<LoginForm next="/inicio" />}>
        <LoginFormWithParams searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginFormWithParams({ searchParams }: Pick<PageProps<"/entrar">, "searchParams">) {
  const params = await searchParams;
  const error = typeof params.erro === "string" ? LINK_ERRORS[params.erro] : undefined;
  return (
    <>
      {error ? (
        <p role="alert" className="rounded-[var(--radius-control)] bg-critical-bg px-3 py-2 text-sm text-critical">
          {error}
        </p>
      ) : null}
      <LoginForm next={safeNextPath(params.next)} />
    </>
  );
}
