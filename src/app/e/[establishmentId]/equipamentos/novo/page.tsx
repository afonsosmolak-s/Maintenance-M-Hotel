import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireEstablishment } from "@/lib/auth/session";
import { buildLocationTree, flattenTree } from "@/lib/domain/locations";
import { loadStructure } from "../../configuracoes/data";
import { saveAsset } from "../actions";
import { AssetFields } from "../asset-fields";

export const metadata: Metadata = { title: "Novo equipamento" };

export default function NewAssetPage({ params }: PageProps<"/e/[establishmentId]/equipamentos/novo">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <NewAsset params={params} />
    </Suspense>
  );
}

async function NewAsset({ params }: Pick<PageProps<"/e/[establishmentId]/equipamentos/novo">, "params">) {
  const { establishmentId } = await params;
  const { can } = await requireEstablishment(establishmentId);
  if (!can("assets.manage")) notFound();
  const { locations, categories, paths } = await loadStructure(establishmentId);

  const locationOptions = flattenTree(buildLocationTree(locations.filter((l) => l.active))).map((l) => ({
    id: l.id,
    label: paths.get(l.id) ?? l.name,
  }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href={`/e/${establishmentId}/equipamentos`} className="text-sm text-muted hover:text-ink">
          ← Equipamentos
        </Link>
        <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">Novo equipamento</h1>
      </header>
      <ActionForm action={saveAsset.bind(null, establishmentId)} className="flex max-w-4xl flex-col gap-6">
        <AssetFields locations={locationOptions} categories={categories.filter((c) => c.active)} />
        <div>
          <SubmitButton pendingLabel="Guardando…">Cadastrar equipamento</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
