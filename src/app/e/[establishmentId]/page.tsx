import Link from "next/link";
import { Suspense } from "react";
import { buttonClasses } from "@/components/ui/button";
import { WorkOrderCard } from "@/components/work-orders/work-order-card";
import { requireEstablishment, requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { compareByUrgency } from "@/lib/domain/work-orders";
import { loadStructure } from "./configuracoes/data";
import { loadTeam, loadWorkOrders } from "./ocorrencias/data";

export default function EstablishmentHome({ params }: PageProps<"/e/[establishmentId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <Home params={params} />
    </Suspense>
  );
}

async function Home({ params }: Pick<PageProps<"/e/[establishmentId]">, "params">) {
  const { establishmentId } = await params;
  const { establishment, can } = await requireEstablishment(establishmentId);
  const me = await requireUser();

  const [open, { paths }, team] = await Promise.all([
    loadWorkOrders(establishmentId, { view: "abertas", userId: me.id }),
    loadStructure(establishmentId),
    loadTeam(establishmentId),
  ]);
  const now = new Date();
  open.sort((a, b) => compareByUrgency(a, b, now));
  const names = new Map(team.map((m) => [m.id, m.name]));
  const base = `/e/${establishmentId}/ocorrencias`;

  const mine = open.filter((w) => w.assigneeId === me.id);
  const critical = open.filter((w) => w.priority === "critical");
  const overdue = open.filter((w) => w.overdue);
  const unassigned = open.filter((w) => !w.assigneeId);
  const inProgress = open.filter((w) => w.status === "in_progress");

  const counters = [
    { label: "Críticas", value: critical.length, href: `${base}?prioridade=critical`, tone: critical.length ? "text-critical" : "" },
    { label: "Atrasadas", value: overdue.length, href: `${base}?vista=atrasadas`, tone: overdue.length ? "text-overdue" : "" },
    { label: "Em andamento", value: inProgress.length, href: base, tone: "" },
    { label: "Sem responsável", value: unassigned.length, href: `${base}?vista=sem-responsavel`, tone: "" },
  ];

  const card = (w: (typeof open)[number]) => (
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
          preventive: w.preventive,
        }}
      />
    </li>
  );

  // Gestão vê primeiro o que precisa de atenção; quem executa vê primeiro as suas tarefas.
  const managerFirst = can("work_orders.assign");
  const attention = open.filter((w) => w.priority === "critical" || w.overdue || !w.assigneeId).slice(0, 8);
  const mineSection = { key: "mine", title: "Minhas tarefas", list: mine, empty: "Nenhum serviço atribuído a você agora." };
  const attentionSection = { key: "attention", title: "Precisa de atenção", list: attention, empty: "Nada crítico, atrasado ou sem responsável." };

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{establishment.roleName}</p>
          <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">{establishment.name}</h1>
        </div>
        {can("work_orders.create") ? (
          <Link href={`${base}/nova`} className={buttonClasses({ size: "lg" })}>
            Nova ocorrência
          </Link>
        ) : null}
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-control)] border border-line bg-line sm:grid-cols-4">
        {counters.map((c) => (
          <Link key={c.label} href={c.href} className="flex flex-col gap-1 bg-paper p-4 hover:bg-surface">
            <span className={cn("text-3xl font-[550] tabular-nums tracking-[-0.03em]", c.tone)}>{c.value}</span>
            <span className="text-xs text-muted">{c.label}</span>
          </Link>
        ))}
      </section>

      {(managerFirst ? [attentionSection, mineSection] : [mineSection, attentionSection])
        .map((section) => (
          <section key={section.key} className="flex flex-col gap-3" aria-labelledby={`h-${section.key}`}>
            <div className="flex items-baseline justify-between">
              <h2 id={`h-${section.key}`} className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                {section.title} ({section.list.length})
              </h2>
              <Link href={section.key === "mine" ? `${base}?vista=minhas` : base} className="text-sm text-muted hover:text-ink">
                Ver todas →
              </Link>
            </div>
            {section.list.length ? (
              <ul className="flex flex-col divide-y divide-line border-y border-line">{section.list.map(card)}</ul>
            ) : (
              <p className="border-y border-line py-6 text-sm text-muted">{section.empty}</p>
            )}
          </section>
        ))}
    </div>
  );
}
