import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireEstablishment } from "@/lib/auth/session";
import { ASSET_STATUS_LABELS, isAssetStatus, isUnderWarranty } from "@/lib/domain/assets";
import { buildLocationTree, flattenTree } from "@/lib/domain/locations";
import { isWorkOrderStatus } from "@/lib/domain/work-orders";
import { StatusBadge } from "@/components/work-orders/indicators";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadStructure } from "../../configuracoes/data";
import { deleteAsset, saveAsset } from "../actions";
import { AssetFields } from "../asset-fields";

export const metadata: Metadata = { title: "Equipamento" };

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default function AssetPage({ params }: PageProps<"/e/[establishmentId]/equipamentos/[assetId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <Asset params={params} />
    </Suspense>
  );
}

async function Asset({ params }: Pick<PageProps<"/e/[establishmentId]/equipamentos/[assetId]">, "params">) {
  const { establishmentId, assetId } = await params;
  if (!z.uuid().safeParse(assetId).success) notFound();
  const { can } = await requireEstablishment(establishmentId);

  const supabase = await createSupabaseServerClient();
  const { data: asset } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  if (!asset) notFound();

  const [{ locations, categories, paths }, { data: history }] = await Promise.all([
    loadStructure(establishmentId),
    supabase
      .from("work_orders")
      .select("id, number, title, status, opened_at, completed_at")
      .eq("establishment_id", establishmentId)
      .eq("asset_id", assetId)
      .order("opened_at", { ascending: false })
      .limit(30),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const woBase = `/e/${establishmentId}/ocorrencias`;
  const historySection = (
    <section className="flex max-w-4xl flex-col gap-3" aria-labelledby="historico">
      <h2 id="historico" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        Histórico de intervenções ({history?.length ?? 0})
      </h2>
      {history?.length ? (
        <ul className="flex flex-col divide-y divide-line border-y border-line text-sm">
          {history.map((w) => (
            <li key={w.id}>
              <Link href={`${woBase}/${w.number}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-surface">
                <span>
                  <span className="text-muted">#{String(w.number).padStart(4, "0")}</span> {w.title}
                </span>
                <span className="flex items-center gap-3 text-xs text-muted">
                  {isWorkOrderStatus(w.status) ? <StatusBadge status={w.status} /> : null}
                  {dateTimeFormat.format(new Date(w.opened_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhuma ocorrência ligada a este equipamento.</p>
      )}
    </section>
  );
  const back = `/e/${establishmentId}/equipamentos`;

  const header = (
    <header className="flex flex-col gap-2">
      <Link href={back} className="text-sm text-muted hover:text-ink">
        ← Equipamentos
      </Link>
      <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">{asset.name}</h1>
      <p className="text-sm text-muted">
        {paths.get(asset.location_id)}
        {asset.warranty_until
          ? ` · ${isUnderWarranty(asset.warranty_until, today) ? "Na garantia até" : "Garantia terminou em"} ${dateFormat.format(new Date(asset.warranty_until))}`
          : ""}
      </p>
    </header>
  );

  if (!can("assets.manage")) {
    const category = categories.find((c) => c.id === asset.category_id)?.name;
    return (
      <div className="flex flex-col gap-8">
        {header}
        <dl className="grid max-w-2xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Estado</dt>
          <dd>{isAssetStatus(asset.operational_status) ? ASSET_STATUS_LABELS[asset.operational_status] : asset.operational_status}</dd>
          {category ? (
            <>
              <dt className="text-muted">Categoria</dt>
              <dd>{category}</dd>
            </>
          ) : null}
          {asset.internal_code ? (
            <>
              <dt className="text-muted">Código</dt>
              <dd>{asset.internal_code}</dd>
            </>
          ) : null}
          {asset.manufacturer || asset.model ? (
            <>
              <dt className="text-muted">Fabricante / modelo</dt>
              <dd>{[asset.manufacturer, asset.model].filter(Boolean).join(" · ")}</dd>
            </>
          ) : null}
          {asset.notes ? (
            <>
              <dt className="text-muted">Observações</dt>
              <dd className="whitespace-pre-line">{asset.notes}</dd>
            </>
          ) : null}
        </dl>
        {historySection}
      </div>
    );
  }

  // Na edição, mantém o local atual mesmo que esteja desativado.
  const locationOptions = flattenTree(
    buildLocationTree(locations.filter((l) => l.active || l.id === asset.location_id)),
  ).map((l) => ({ id: l.id, label: paths.get(l.id) ?? l.name }));
  const categoryOptions = categories.filter((c) => c.active || c.id === asset.category_id);

  return (
    <div className="flex flex-col gap-8">
      {header}
      <ActionForm action={saveAsset.bind(null, establishmentId)} className="flex max-w-4xl flex-col gap-6">
        <AssetFields values={asset} locations={locationOptions} categories={categoryOptions} />
        <div>
          <SubmitButton pendingLabel="Guardando…">Guardar alterações</SubmitButton>
        </div>
      </ActionForm>
      {historySection}
      <section className="flex max-w-4xl flex-col gap-3 border-t border-line pt-6">
        <ActionForm action={deleteAsset.bind(null, establishmentId)}>
          <input type="hidden" name="id" value={asset.id} />
          <ConfirmButton variant="ghost" size="sm" className="self-start text-critical" confirmText={`Excluir ${asset.name}?`}>
            Excluir equipamento
          </ConfirmButton>
        </ActionForm>
      </section>
    </div>
  );
}
