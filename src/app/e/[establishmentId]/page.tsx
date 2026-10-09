import { Suspense } from "react";
import { requireEstablishment } from "@/lib/auth/session";

export default function EstablishmentHome({ params }: PageProps<"/e/[establishmentId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <Home params={params} />
    </Suspense>
  );
}

async function Home({ params }: Pick<PageProps<"/e/[establishmentId]">, "params">) {
  const { establishmentId } = await params;
  const { establishment } = await requireEstablishment(establishmentId);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{establishment.roleName}</p>
      <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">
        {establishment.name}
      </h1>
      <p className="max-w-[56ch] text-sm text-muted">
        As ocorrências, o painel de gestão e a manutenção preventiva chegam nas próximas etapas. Por enquanto, a
        gestão pode montar a equipe e os cargos.
      </p>
    </section>
  );
}
