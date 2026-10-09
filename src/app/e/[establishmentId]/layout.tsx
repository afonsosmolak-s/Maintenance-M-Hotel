import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NavLink } from "@/components/layout/nav-link";
import { brand } from "@/config/brand";
import { getMyEstablishments, requireEstablishment } from "@/lib/auth/session";

/**
 * Cabeçalho: no computador, uma linha (unidade · menu · sair).
 * No celular, duas linhas: unidade e sair em cima, menu deslizante por baixo.
 */
export default function EstablishmentLayout({ children, params }: LayoutProps<"/e/[establishmentId]">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-8 px-[clamp(16px,4.4vw,72px)] pt-3 sm:flex-nowrap sm:pt-0">
          <Suspense fallback={<span className="order-1 py-2 text-sm text-muted sm:py-0">{brand.shortName}</span>}>
            <EstablishmentNav params={params} />
          </Suspense>
          <div className="order-2 ml-auto sm:order-3">
            <SignOutButton variant="ghost" />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-8 px-[clamp(16px,4.4vw,72px)] py-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}

async function EstablishmentNav({ params }: Pick<LayoutProps<"/e/[establishmentId]">, "params">) {
  const { establishmentId } = await params;
  const { establishment, can } = await requireEstablishment(establishmentId);
  const hasOthers = (await getMyEstablishments()).filter((e) => !e.blocked).length > 1;
  const base = `/e/${establishment.id}`;

  return (
    <>
      <span className="order-1 flex min-w-0 max-w-[60%] flex-col leading-tight sm:max-w-56">
        <span className="truncate text-sm font-semibold">{establishment.name}</span>
        {hasOthers ? (
          <Link href="/selecionar" className="text-xs text-muted hover:text-ink">
            Trocar unidade
          </Link>
        ) : (
          <span className="truncate text-xs text-muted">{establishment.roleName}</span>
        )}
      </span>
      <nav
        aria-label="Principal"
        className="order-3 mt-1 flex w-full gap-5 overflow-x-auto sm:order-2 sm:mt-0 sm:w-auto sm:flex-1"
      >
        <NavLink href={base} exact>
          Início
        </NavLink>
        <NavLink href={`${base}/ocorrencias`}>Ocorrências</NavLink>
        {can("dashboard.read") ? <NavLink href={`${base}/painel`}>Painel</NavLink> : null}
        {can("preventive.manage") || can("dashboard.read") || can("work_orders.read_all") ? (
          <NavLink href={`${base}/preventivas`}>Preventivas</NavLink>
        ) : null}
        <NavLink href={`${base}/equipamentos`}>Equipamentos</NavLink>
        {can("members.manage") ? <NavLink href={`${base}/equipe`}>Equipe</NavLink> : null}
        {can("settings.manage") ? <NavLink href={`${base}/configuracoes`}>Configurações</NavLink> : null}
      </nav>
    </>
  );
}
