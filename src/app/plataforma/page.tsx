import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { brand } from "@/config/brand";
import { getPlatformAccess, requireUser } from "@/lib/auth/session";
import { formatCnpj } from "@/lib/domain/cnpj";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewEstablishmentForm, StatusToggle } from "./platform-forms";

export const metadata: Metadata = { title: "Plataforma" };

const KIND_LABEL: Record<string, string> = { motel: "Motel", hotel: "Hotel", other: "Outro" };
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default function PlatformPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center justify-between px-[clamp(16px,4.4vw,72px)]">
          <span className="text-sm font-semibold">
            {brand.company} <span className="font-normal text-muted">· Plataforma</span>
          </span>
          <SignOutButton variant="ghost" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-14 px-[clamp(16px,4.4vw,72px)] py-10">
        <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
          <Platform />
        </Suspense>
      </main>
    </div>
  );
}

async function Platform() {
  await requireUser();
  const access = await getPlatformAccess();
  if (access === "none") notFound();
  if (access === "needs_mfa") redirect("/plataforma/verificacao");

  const supabase = await createSupabaseServerClient();
  const { data: establishments, error } = await supabase.rpc("platform_establishments");
  if (error) throw new Error("Não foi possível carregar os estabelecimentos.");

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">Clientes</h1>
        <p className="text-sm text-muted">
          Dados de conta apenas. Ocorrências, fotos e dados operacionais dos clientes não aparecem aqui.
        </p>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="lista">
        <h2 id="lista" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Estabelecimentos ({establishments.length})
        </h2>
        {establishments.length === 0 ? (
          <p className="border-y border-line py-6 text-sm text-muted">Nenhum estabelecimento cadastrado ainda.</p>
        ) : (
          <div className="overflow-x-auto border-y border-line">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-3 pr-4 font-semibold">Estabelecimento</th>
                  <th className="py-3 pr-4 font-semibold">CNPJ</th>
                  <th className="py-3 pr-4 font-semibold">Proprietário</th>
                  <th className="py-3 pr-4 font-semibold">Equipe</th>
                  <th className="py-3 pr-4 font-semibold">Último acesso</th>
                  <th className="py-3 font-semibold">Conta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {establishments.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="py-3 pr-4">
                      <span className="block font-semibold">{e.name}</span>
                      <span className="text-xs text-muted">
                        {KIND_LABEL[e.kind] ?? e.kind} · {e.legal_name}
                      </span>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{formatCnpj(e.cnpj)}</td>
                    <td className="py-3 pr-4">
                      <span className="block">{e.owner_name || "Convite pendente"}</span>
                      <span className="text-xs text-muted">{e.owner_email}</span>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{e.member_count}</td>
                    <td className="py-3 pr-4 text-muted">
                      {e.last_sign_in_at ? dateFormat.format(new Date(e.last_sign_in_at)) : "Nunca"}
                    </td>
                    <td className="py-3">
                      <StatusToggle id={e.id} name={e.name} status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="novo">
        <h2 id="novo" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Novo estabelecimento
        </h2>
        <NewEstablishmentForm />
      </section>
    </>
  );
}
