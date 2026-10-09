import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BarList } from "@/components/dashboard/bar-list";
import { StatGrid, StatTile } from "@/components/dashboard/stat-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PriorityIndicator } from "@/components/work-orders/indicators";
import { requireEstablishment } from "@/lib/auth/session";
import { formatHours, MIN_SAMPLE_FOR_AVERAGES, resolvePeriod } from "@/lib/domain/dashboard";
import {
  isWorkOrderPriority,
  isWorkOrderStatus,
  PRIORITY_LABELS,
  STATUS_LABELS,
  WORK_ORDER_PRIORITIES,
  type WorkOrderPriority,
} from "@/lib/domain/work-orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadStructure } from "../configuracoes/data";
import { loadTeam } from "../ocorrencias/data";

export const metadata: Metadata = { title: "Painel de gestão" };

type Metrics = {
  now: Record<"open" | "critical" | "high" | "medium" | "low" | "pending" | "assigned" | "in_progress" | "on_hold" | "overdue" | "unassigned", number>;
  period: {
    opened: number;
    completed: number;
    cancelled: number;
    resolution_sample: number;
    resolution_avg_hours: number | null;
    resolution_median_hours: number | null;
    on_time: number;
    with_due: number;
    cost_total: number | null;
    preventive_completed: number;
  };
  by_sector: { id: string; name: string; open: number; overdue: number; completed: number }[];
  by_assignee: { id: string; name: string; open: number; in_progress: number; overdue: number; completed: number; avg_hours: number | null }[];
  by_category: { name: string; open: number; opened: number }[];
  recurring_assets: { id: string; name: string; location_id: string; count: number }[];
};

const OPEN_STATUSES = ["pending", "assigned", "in_progress", "on_hold"] as const;
const sectionTitle = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export default function DashboardPage({ params, searchParams }: PageProps<"/e/[establishmentId]/painel">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Calculando indicadores…</p>}>
      <Dashboard params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ params, searchParams }: PageProps<"/e/[establishmentId]/painel">) {
  const { establishmentId } = await params;
  const query = await searchParams;
  const { can } = await requireEstablishment(establishmentId);
  if (!can("dashboard.read")) notFound();

  const pick = (key: string) => (typeof query[key] === "string" && query[key] ? (query[key] as string) : undefined);
  const period = resolvePeriod({ periodo: pick("periodo"), de: pick("de"), ate: pick("ate") }, new Date());
  const sector = pick("setor");
  const priorityParam = pick("prioridade");
  const priority = priorityParam && isWorkOrderPriority(priorityParam) ? priorityParam : undefined;
  const statusParam = pick("estado");
  const status = statusParam && isWorkOrderStatus(statusParam) && (OPEN_STATUSES as readonly string[]).includes(statusParam) ? statusParam : undefined;
  const assignee = pick("responsavel");

  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { locations, paths }, team] = await Promise.all([
    supabase.rpc("dashboard_metrics", {
      p_establishment_id: establishmentId,
      p_from: period.from,
      p_to: period.to,
      p_sector_id: sector ?? null,
      p_priority: priority ?? null,
      p_assignee_id: assignee ?? null,
      p_status: status ?? null,
    }),
    loadStructure(establishmentId),
    loadTeam(establishmentId),
  ]);
  if (error || !data) throw new Error("Não foi possível calcular os indicadores.");
  const m = data as unknown as Metrics;

  const list = `/e/${establishmentId}/ocorrencias`;
  const p = m.period;
  const enoughSample = p.resolution_sample >= MIN_SAMPLE_FOR_AVERAGES;
  const onTimePct = p.with_due > 0 ? Math.round((p.on_time / p.with_due) * 100) : null;
  const sectors = locations.filter((l) => l.parentId === null);
  const filtered = Boolean(sector || priority || assignee || status);

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">Painel de gestão</h1>
        <p className="text-sm text-muted">Números calculados a partir das ocorrências registradas. Nada aqui é estimado.</p>
      </header>

      <form className="flex flex-wrap items-end gap-3" aria-label="Filtros do painel">
        <Select label="Período" name="periodo" defaultValue={period.preset === "custom" ? "" : period.preset} className="min-w-36">
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
          <option value="">Datas abaixo</option>
        </Select>
        <Input label="De" name="de" type="date" defaultValue={period.preset === "custom" ? period.fromDate : ""} className="w-40" />
        <Input label="Até" name="ate" type="date" defaultValue={period.preset === "custom" ? period.toDate : ""} className="w-40" />
        <Select label="Setor" name="setor" defaultValue={sector ?? ""} className="min-w-36">
          <option value="">Todos</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select label="Prioridade" name="prioridade" defaultValue={priority ?? ""} className="min-w-32">
          <option value="">Todas</option>
          {WORK_ORDER_PRIORITIES.map((pr) => (
            <option key={pr} value={pr}>
              {PRIORITY_LABELS[pr]}
            </option>
          ))}
        </Select>
        <Select label="Estado (abertas)" name="estado" defaultValue={status ?? ""} className="min-w-40">
          <option value="">Todos</option>
          {OPEN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select label="Responsável" name="responsavel" defaultValue={assignee ?? ""} className="min-w-40">
          <option value="">Todos</option>
          {team
            .filter((t) => t.canExecute)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </Select>
        <Button type="submit" variant="secondary">
          Aplicar
        </Button>
        {filtered || period.preset !== "30d" ? (
          <Link href={`/e/${establishmentId}/painel`} className="mb-2.5 text-sm text-muted underline-offset-4 hover:underline">
            Limpar
          </Link>
        ) : null}
      </form>

      <section className="flex flex-col gap-4" aria-labelledby="agora">
        <h2 id="agora" className={sectionTitle}>
          Agora
        </h2>
        <StatGrid label="Situação atual">
          <StatTile label="Abertas" value={m.now.open} href={list} />
          <StatTile label="Críticas" value={m.now.critical} href={`${list}?prioridade=critical`} tone={m.now.critical ? "critical" : undefined} />
          <StatTile label="Atrasadas" value={m.now.overdue} href={`${list}?vista=atrasadas`} tone={m.now.overdue ? "overdue" : undefined} />
          <StatTile label="Em andamento" value={m.now.in_progress} href={list} />
          <StatTile label="Aguardando material" value={m.now.on_hold} href={list} />
          <StatTile label="Sem responsável" value={m.now.unassigned} href={`${list}?vista=sem-responsavel`} />
        </StatGrid>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="periodo">
        <h2 id="periodo" className={sectionTitle}>
          No período · {shortDate(period.fromDate)} a {shortDate(period.toDate)}
        </h2>
        <StatGrid label="Indicadores do período">
          <StatTile label="Abertas" value={p.opened} />
          <StatTile label="Concluídas" value={p.completed} href={`${list}?vista=concluidas`} />
          <StatTile label="Canceladas" value={p.cancelled} href={`${list}?vista=canceladas`} />
          <StatTile
            label="Tempo médio de resolução"
            value={enoughSample ? formatHours(p.resolution_avg_hours) : "—"}
            hint={
              enoughSample
                ? `Mediana ${formatHours(p.resolution_median_hours)} · ${p.resolution_sample} concluídas`
                : `Dados insuficientes (${p.resolution_sample} de ${MIN_SAMPLE_FOR_AVERAGES} concluídas)`
            }
          />
          <StatTile
            label="Concluídas no prazo"
            value={onTimePct === null ? "—" : `${onTimePct}%`}
            hint={p.with_due > 0 ? `${p.on_time} de ${p.with_due}` : "Sem conclusões com prazo"}
          />
          {p.cost_total !== null ? (
            <StatTile label="Custo registrado" value={money.format(p.cost_total)} hint="Materiais + mão de obra das concluídas" />
          ) : (
            <StatTile label="Preventivas concluídas" value={p.preventive_completed} />
          )}
        </StatGrid>
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section className="flex flex-col gap-4" aria-labelledby="prioridades">
          <h2 id="prioridades" className={sectionTitle}>
            Abertas por prioridade
          </h2>
          <BarList
            valueLabel="Ocorrências abertas por prioridade"
            emptyText="Nenhuma ocorrência aberta."
            items={
              m.now.open
                ? WORK_ORDER_PRIORITIES.map((pr: WorkOrderPriority) => ({
                    key: pr,
                    label: <PriorityIndicator priority={pr} />,
                    value: m.now[pr],
                  }))
                : []
            }
          />
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="setores">
          <h2 id="setores" className={sectionTitle}>
            Abertas por setor
          </h2>
          <BarList
            valueLabel="Ocorrências abertas por setor"
            emptyText="Sem ocorrências abertas ou concluídas no período por setor."
            items={m.by_sector.map((s) => ({
              key: s.id,
              label: s.name,
              value: s.open,
              detail: [s.overdue ? `${s.overdue} atrasada(s)` : "", `${s.completed} concluída(s) no período`].filter(Boolean).join(" · "),
            }))}
          />
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="categorias">
          <h2 id="categorias" className={sectionTitle}>
            Abertas no período por categoria
          </h2>
          <BarList
            valueLabel="Ocorrências abertas no período por categoria"
            emptyText="Nenhuma ocorrência aberta no período."
            items={m.by_category
              .filter((c) => c.opened > 0)
              .map((c) => ({ key: c.name, label: c.name, value: c.opened, detail: c.open ? `${c.open} ainda aberta(s)` : undefined }))}
          />
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="recorrentes">
          <h2 id="recorrentes" className={sectionTitle}>
            Equipamentos com falhas repetidas
          </h2>
          {m.recurring_assets.length ? (
            <ul className="flex flex-col divide-y divide-line border-y border-line text-sm">
              {m.recurring_assets.map((a) => (
                <li key={a.id}>
                  <Link href={`/e/${establishmentId}/equipamentos/${a.id}`} className="flex justify-between gap-4 py-3 hover:bg-surface">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{a.name}</span>
                      <span className="block truncate text-xs text-muted">{paths.get(a.location_id)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{a.count} ocorrências</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border-y border-line py-6 text-sm text-muted">Nenhum equipamento com 2 ou mais ocorrências no período.</p>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="equipe">
        <h2 id="equipe" className={sectionTitle}>
          Carga por responsável
        </h2>
        {m.by_assignee.length ? (
          <div className="overflow-x-auto border-y border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-3 pr-4 font-semibold">Responsável</th>
                  <th className="py-3 pr-4 text-right font-semibold">Abertas</th>
                  <th className="py-3 pr-4 text-right font-semibold">Em andamento</th>
                  <th className="py-3 pr-4 text-right font-semibold">Atrasadas</th>
                  <th className="py-3 pr-4 text-right font-semibold">Concluídas no período</th>
                  <th className="py-3 text-right font-semibold">Tempo médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {m.by_assignee.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 pr-4">
                      <Link href={`${list}?responsavel=${a.id}`} className="hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-right">{a.open}</td>
                    <td className="py-3 pr-4 text-right">{a.in_progress}</td>
                    <td className={`py-3 pr-4 text-right ${a.overdue ? "font-semibold text-overdue" : ""}`}>{a.overdue}</td>
                    <td className="py-3 pr-4 text-right">{a.completed}</td>
                    <td className="py-3 text-right">{a.completed >= MIN_SAMPLE_FOR_AVERAGES ? formatHours(a.avg_hours) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border-y border-line py-6 text-sm text-muted">Nenhuma ocorrência com responsável neste recorte.</p>
        )}
      </section>
    </div>
  );
}
