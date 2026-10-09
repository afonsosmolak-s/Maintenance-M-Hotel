import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { brand } from "@/config/brand";
import { getMyEstablishments, requireEstablishment } from "@/lib/auth/session";

export default function EstablishmentLayout({ children, params }: LayoutProps<"/e/[establishmentId]">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-[1320px] items-center justify-between gap-4 px-[clamp(16px,4.4vw,72px)]">
          <Suspense fallback={<span className="text-sm text-muted">{brand.shortName}</span>}>
            <EstablishmentNav params={params} />
          </Suspense>
          <SignOutButton variant="ghost" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-8 px-[clamp(16px,4.4vw,72px)] py-10">
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
    <nav aria-label="Principal" className="flex min-w-0 items-center gap-6 text-sm">
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-semibold">{establishment.name}</span>
        {hasOthers ? (
          <Link href="/selecionar" className="text-xs text-muted hover:text-ink">
            Trocar unidade
          </Link>
        ) : (
          <span className="text-xs text-muted">{establishment.roleName}</span>
        )}
      </span>
      <Link href={base} className="text-muted hover:text-ink">
        Início
      </Link>
      {can("members.manage") ? (
        <Link href={`${base}/equipe`} className="text-muted hover:text-ink">
          Equipe
        </Link>
      ) : null}
    </nav>
  );
}
