import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { requireEstablishment } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { ASSET_STATUSES, ASSET_STATUS_LABELS, isAssetStatus } from "@/lib/domain/assets";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadStructure } from "../configuracoes/data";

export const metadata: Metadata = { title: "Equipamentos" };

const statusTone: Record<string, string> = {
  operational: "bg-success-bg text-success",
  degraded: "bg-overdue-bg text-overdue",
  down: "bg-critical-bg text-critical",
  retired: "bg-surface text-muted",
};

export default function AssetsPage({ params, searchParams }: PageProps<"/e/[establishmentId]/equipamentos">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando equipamentos…</p>}>
      <Assets params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Assets({ params, searchParams }: PageProps<"/e/[establishmentId]/equipamentos">) {
  const { establishmentId } = await params;
  const query = await searchParams;
  const { can } = await requireEstablishment(establishmentId);
  const { categories, locations, paths } = await loadStructure(establishmentId);

  const pick = (key: string) => (typeof query[key] === "string" && query[key] ? (query[key] as string) : undefined);
  const sector = pick("setor");
  const category = pick("categoria");
  const status = pick("estado");

  const supabase = await createSupabaseServerClient();
  let request = supabase
    .from("assets")
    .select("id, name, internal_code, operational_status, location_id, category_id, locations!inner(sector_id)")
    .eq("establishment_id", establishmentId)
    .order("name");
  if (sector) request = request.eq("locations.sector_id", sector);
  if (category) request = request.eq("category_id", category);
  if (status && isAssetStatus(status)) request = request.eq("operational_status", status);
  const { data: assets, error } = await request;
  if (error) throw new Error("Não foi possível carregar os equipamentos.");

  const sectors = locations.filter((l) => l.parentId === null);
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const base = `/e/${establishmentId}/equipamentos`;
  const filtered = Boolean(sector || category || status);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">Equipamentos</h1>
          <p className="text-sm text-muted">Ativos do estabelecimento e onde ficam.</p>
        </div>
        {can("assets.manage") && locations.length > 0 ? (
          <Link href={`${base}/novo`} className={buttonClasses()}>
            Novo equipamento
          </Link>
        ) : null}
      </header>

      {locations.length === 0 ? (
        <p className="border-y border-line py-6 text-sm text-muted">
          Cadastre primeiro os locais do estabelecimento em{" "}
          <Link href={`/e/${establishmentId}/configuracoes`} className="underline underline-offset-4">
            Configurações
          </Link>
          . Cada equipamento fica num local.
        </p>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3" aria-label="Filtros">
            <Select label="Setor" name="setor" defaultValue={sector ?? ""} className="min-w-44">
              <option value="">Todos</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select label="Categoria" name="categoria" defaultValue={category ?? ""} className="min-w-44">
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Estado" name="estado" defaultValue={status ?? ""} className="min-w-44">
              <option value="">Todos</option>
              {ASSET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ASSET_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
            {filtered ? (
              <Link href={base} className="mb-2.5 text-sm text-muted underline-offset-4 hover:underline">
                Limpar
              </Link>
            ) : null}
          </form>

          {assets.length === 0 ? (
            <p className="border-y border-line py-6 text-sm text-muted">
              {filtered ? "Nenhum equipamento com estes filtros." : "Nenhum equipamento cadastrado ainda."}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {assets.map((a) => (
                <li key={a.id}>
                  <Link href={`${base}/${a.id}`} className="flex flex-col gap-1 py-4 hover:bg-surface sm:flex-row sm:items-center sm:justify-between sm:px-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold">
                        {a.name}
                        {a.internal_code ? <span className="ml-2 text-xs font-normal tabular-nums text-muted">{a.internal_code}</span> : null}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {paths.get(a.location_id)}
                        {a.category_id ? ` · ${categoryName.get(a.category_id) ?? ""}` : ""}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "self-start rounded-[var(--radius-control)] px-2 py-0.5 text-xs font-semibold sm:self-center",
                        statusTone[a.operational_status],
                      )}
                    >
                      {isAssetStatus(a.operational_status) ? ASSET_STATUS_LABELS[a.operational_status] : a.operational_status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
