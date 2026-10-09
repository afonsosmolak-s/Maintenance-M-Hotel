import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { WorkOrderCard } from "@/components/work-orders/work-order-card";
import { requireEstablishment, requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { descendantIds } from "@/lib/domain/locations";
import { compareByUrgency, isWorkOrderPriority, PRIORITY_LABELS, WORK_ORDER_PRIORITIES } from "@/lib/domain/work-orders";
import { loadStructure } from "../configuracoes/data";
import { isView, loadTeam, loadWorkOrders, VIEWS, type View } from "./data";

export const metadata: Metadata = { title: "Ocorrências" };

export default function WorkOrdersPage({ params, searchParams }: PageProps<"/e/[establishmentId]/ocorrencias">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando ocorrências…</p>}>
      <WorkOrders params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkOrders({ params, searchParams }: PageProps<"/e/[establishmentId]/ocorrencias">) {
  const { establishmentId } = await params;
  const query = await searchParams;
  const { can } = await requireEstablishment(establishmentId);
  const me = await requireUser();

  const pick = (key: string) => (typeof query[key] === "string" && query[key] ? (query[key] as string) : undefined);
  const view: View = isView(pick("vista")) ? (pick("vista") as View) : "abertas";
  const sector = pick("setor");
  const priorityParam = pick("prioridade");
  const priority = priorityParam && isWorkOrderPriority(priorityParam) ? priorityParam : undefined;
  const assigneeId = pick("responsavel");

  const [{ locations, paths }, team] = await Promise.all([loadStructure(establishmentId), loadTeam(establishmentId)]);
  const sectorIds = sector ? [...descendantIds(locations, sector)] : undefined;
  const workOrders = await loadWorkOrders(establishmentId, { view, userId: me.id, sectorLocationIds: sectorIds, priority, assigneeId });

  const now = new Date();
  const isOpenView = view !== "concluidas" && view !== "canceladas";
  if (isOpenView) workOrders.sort((a, b) => compareByUrgency(a, b, now));

  const names = new Map(team.map((m) => [m.id, m.name]));
  const base = `/e/${establishmentId}/ocorrencias`;
  const sectors = locations.filter((l) => l.parentId === null);
  const filtered = Boolean(sector || priority || assigneeId);
  const keep = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { vista: view, setor: sector, prioridade: priority, responsavel: assigneeId, ...next };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "vista" && v === "abertas")) params.set(k, v);
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">Ocorrências</h1>
          <p className="text-sm text-muted">Problemas registrados e o andamento de cada serviço.</p>
        </div>
        {can("work_orders.create") ? (
          <Link href={`${base}/nova`} className={buttonClasses({ size: "lg" })}>
            Nova ocorrência
          </Link>
        ) : null}
      </header>

      <nav aria-label="Vistas" className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 text-sm">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={keep({ vista: v })}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 pb-3",
              v === view ? "border-ink font-semibold" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {VIEWS[v]}
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-end gap-3" aria-label="Filtros">
        {view !== "abertas" ? <input type="hidden" name="vista" value={view} /> : null}
        <Select label="Setor" name="setor" defaultValue={sector ?? ""} className="min-w-40">
          <option value="">Todos</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select label="Prioridade" name="prioridade" defaultValue={priority ?? ""} className="min-w-36">
          <option value="">Todas</option>
          {WORK_ORDER_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
        {view !== "minhas" ? (
          <Select label="Responsável" name="responsavel" defaultValue={assigneeId ?? ""} className="min-w-40">
            <option value="">Todos</option>
            {team
              .filter((m) => m.canExecute)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </Select>
        ) : null}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {filtered ? (
          <Link href={keep({ setor: undefined, prioridade: undefined, responsavel: undefined })} className="mb-2.5 text-sm text-muted underline-offset-4 hover:underline">
            Limpar
          </Link>
        ) : null}
      </form>

      {workOrders.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-sm text-muted">
          {view === "atrasadas"
            ? "Nada atrasado."
            : view === "minhas"
              ? "Nenhum serviço atribuído a você agora."
              : filtered
                ? "Nenhuma ocorrência com estes filtros."
                : "Nenhuma ocorrência aqui."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line" aria-label={`${workOrders.length} ocorrências`}>
          {workOrders.map((w) => (
            <li key={w.id}>
              <WorkOrderCard
                href={`${base}/${w.number}`}
                now={now}
                data={{
                  number: w.number,
                  title: w.title,
                  status: w.status,
                  priority: w.priority,
                  overdue: w.overdue,
                  openedAt: w.openedAt,
                  locationLabel: paths.get(w.locationId) ?? "",
                  assigneeName: w.assigneeId ? names.get(w.assigneeId) : undefined,
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
