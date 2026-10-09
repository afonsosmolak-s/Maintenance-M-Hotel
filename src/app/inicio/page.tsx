import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentUser, getMyEstablishments, getPlatformAccess } from "@/lib/auth/session";

/** Depois do login: encaminha cada pessoa para onde ela trabalha. */
export default function Home() {
  return (
    <Suspense fallback={<main className="flex-1" aria-busy="true" />}>
      <RouteByAccess />
    </Suspense>
  );
}

async function RouteByAccess() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  const establishments = (await getMyEstablishments()).filter((e) => !e.blocked);
  if (establishments.length === 1) redirect(`/e/${establishments[0].id}`);
  if (establishments.length > 1) redirect("/selecionar");

  if ((await getPlatformAccess()) !== "none") redirect("/plataforma");

  return (
    <AuthShell
      title="Sem acesso ativo"
      description="A sua conta não está ligada a nenhum estabelecimento ativo. Fale com o responsável pelo estabelecimento."
    >
      <SignOutButton />
    </AuthShell>
  );
}
