import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getMyEstablishments, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Escolher unidade" };

const KIND_LABEL: Record<string, string> = { motel: "Motel", hotel: "Hotel", other: "Estabelecimento" };

export default function SelectEstablishmentPage() {
  return (
    <AuthShell title="Escolher unidade" description="Você tem acesso a mais de um estabelecimento.">
      <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
        <EstablishmentList />
      </Suspense>
      <SignOutButton variant="ghost" />
    </AuthShell>
  );
}

async function EstablishmentList() {
  await requireUser();
  const establishments = await getMyEstablishments();

  return (
    <ul className="flex flex-col divide-y divide-line border-y border-line">
      {establishments.map((e) => (
        <li key={e.id}>
          {e.blocked ? (
            <div className="flex items-center justify-between py-4 text-muted">
              <span>{e.name}</span>
              <span className="text-xs">Acesso suspenso</span>
            </div>
          ) : (
            <Link href={`/e/${e.id}`} className="flex items-center justify-between py-4 hover:text-muted">
              <span className="flex flex-col">
                <span className="font-semibold">{e.name}</span>
                <span className="text-xs text-muted">
                  {KIND_LABEL[e.kind] ?? e.kind} · {e.roleName}
                </span>
              </span>
              <span aria-hidden>→</span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
