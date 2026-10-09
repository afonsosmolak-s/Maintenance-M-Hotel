import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireEstablishment } from "@/lib/auth/session";
import { buildLocationTree, flattenTree } from "@/lib/domain/locations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadStructure } from "../../configuracoes/data";
import { loadTeam } from "../data";
import { NewWorkOrderForm } from "./new-work-order-form";

export const metadata: Metadata = { title: "Nova ocorrência" };

export default function NewWorkOrderPage({ params }: PageProps<"/e/[establishmentId]/ocorrencias/nova">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <NewWorkOrder params={params} />
    </Suspense>
  );
}

async function NewWorkOrder({ params }: Pick<PageProps<"/e/[establishmentId]/ocorrencias/nova">, "params">) {
  const { establishmentId } = await params;
  const { can } = await requireEstablishment(establishmentId);
  if (!can("work_orders.create")) notFound();

  const [{ locations, categories, paths }, team, assets] = await Promise.all([
    loadStructure(establishmentId),
    can("work_orders.assign") ? loadTeam(establishmentId) : Promise.resolve([]),
    createSupabaseServerClient().then((s) =>
      s.from("assets").select("id, name, location_id, category_id").eq("establishment_id", establishmentId).neq("operational_status", "retired").order("name"),
    ),
  ]);

  const activeLocations = locations.filter((l) => l.active);
  const locationOptions = flattenTree(buildLocationTree(activeLocations)).map((l) => ({ id: l.id, label: paths.get(l.id) ?? l.name }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <Link href={`/e/${establishmentId}/ocorrencias`} className="text-sm text-muted hover:text-ink">
          ← Ocorrências
        </Link>
        <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">Nova ocorrência</h1>
      </header>

      {locationOptions.length === 0 ? (
        <p className="border-y border-line py-6 text-sm text-muted">
          Ainda não há locais cadastrados. {can("settings.manage") ? (
            <Link href={`/e/${establishmentId}/configuracoes`} className="underline underline-offset-4">
              Cadastre os locais em Configurações.
            </Link>
          ) : (
            "Peça à gestão para cadastrar os locais."
          )}
        </p>
      ) : (
        <NewWorkOrderForm
          establishmentId={establishmentId}
          locations={locationOptions}
          locationTree={activeLocations.map((l) => ({ id: l.id, parentId: l.parentId, name: l.name, sortOrder: l.sortOrder, active: l.active }))}
          assets={(assets.data ?? []).map((a) => ({ id: a.id, name: a.name, locationId: a.location_id, categoryId: a.category_id }))}
          categories={categories.filter((c) => c.active).map((c) => ({ id: c.id, label: c.name }))}
          assignees={team.filter((m) => m.canExecute).map((m) => ({ id: m.id, label: m.name }))}
        />
      )}
    </div>
  );
}
