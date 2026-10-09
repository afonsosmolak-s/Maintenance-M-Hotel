import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { SubmitButton } from "@/components/ui/submit-button";
import { PriorityIndicator, StatusBadge } from "@/components/work-orders/indicators";
import { requireEstablishment } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { localDate } from "@/lib/domain/dashboard";
import { buildLocationTree, flattenTree } from "@/lib/domain/locations";
import { dueState, dueStateLabel, intervalLabel, isIntervalUnit } from "@/lib/domain/preventive";
import { isWorkOrderPriority, isWorkOrderStatus } from "@/lib/domain/work-orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadStructure } from "../configuracoes/data";
import { loadTeam } from "../ocorrencias/data";
import { generateNow, planAction, savePlan } from "./actions";
import { PlanFields } from "./plan-fields";

export const metadata: Metadata = { title: "Preventivas" };

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

export default function PreventivePage({ params }: PageProps<"/e/[establishmentId]/preventivas">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando preventivas…</p>}>
      <Preventive params={params} />
    </Suspense>
  );
}

async function Preventive({ params }: Pick<PageProps<"/e/[establishmentId]/preventivas">, "params">) {
  const { establishmentId } = await params;
  const { can } = await requireEstablishment(establishmentId);
  const canManage = can("preventive.manage");
  if (!canManage && !can("dashboard.read") && !can("work_orders.read_all")) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: plans, error }, structure, team, { data: assets }, { data: openWos }] = await Promise.all([
    supabase.from("preventive_plans").select("*").eq("establishment_id", establishmentId).order("next_due_on"),
    loadStructure(establishmentId),
    loadTeam(establishmentId),
    supabase.from("assets").select("id, name, location_id").eq("establishment_id", establishmentId).neq("operational_status", "retired").order("name"),
    supabase
      .from("work_orders")
      .select("number, status, preventive_plan_id")
      .eq("establishment_id", establishmentId)
      .eq("source", "preventive")
      .in("status", ["pending", "assigned", "in_progress", "on_hold"]),
  ]);
  if (error) throw new Error("Não foi possível carregar as preventivas.");

  const today = localDate(new Date());
  const { paths, locations, categories } = structure;
  const openByPlan = new Map((openWos ?? []).map((w) => [w.preventive_plan_id, w]));
  const names = new Map(team.map((m) => [m.id, m.name]));
  const options = {
    locations: flattenTree(buildLocationTree(locations.filter((l) => l.active))).map((l) => ({ id: l.id, label: paths.get(l.id) ?? l.name })),
    assets: (assets ?? []).map((a) => ({ id: a.id, label: `${a.name} · ${paths.get(a.location_id) ?? ""}` })),
    categories: categories.filter((c) => c.active).map((c) => ({ id: c.id, label: c.name })),
    assignees: team.filter((m) => m.canExecute).map((m) => ({ id: m.id, label: m.name })),
    today,
  };

  const active = (plans ?? []).filter((p) => p.active);
  const paused = (plans ?? []).filter((p) => !p.active);

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">Manutenção preventiva</h1>
          <p className="max-w-[64ch] text-sm text-muted">
            Tarefas que se repetem. A ordem de serviço é criada automaticamente todos os dias às 6h, dentro da
            antecedência de cada plano. Enquanto a ordem anterior estiver aberta, a seguinte não é criada.
          </p>
        </div>
        {canManage ? (
          <ActionForm action={generateNow.bind(null, establishmentId)} className="flex flex-col items-end gap-2">
            <SubmitButton variant="secondary" pendingLabel="Gerando…">
              Gerar ordens agora
            </SubmitButton>
          </ActionForm>
        ) : null}
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="planos">
        <h2 id="planos" className={sectionTitle}>
          Planos ativos ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="border-y border-line py-6 text-sm text-muted">Nenhum plano preventivo ativo.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {active.map((plan) => {
              const state = dueState(plan.next_due_on, today, plan.lead_days);
              const open = openByPlan.get(plan.id);
              const unit = isIntervalUnit(plan.interval_unit) ? plan.interval_unit : "month";
              return (
                <li key={plan.id} className="py-4">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-xs font-semibold text-muted">{paths.get(plan.location_id)}</span>
                        <span className="font-[550]">{plan.title}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>{intervalLabel(unit, plan.interval_count)}</span>
                          <span aria-hidden>·</span>
                          <span>Próxima: {dateFormat.format(new Date(plan.next_due_on))}</span>
                          <span
                            className={cn(
                              "rounded-[var(--radius-control)] px-2 py-0.5 font-semibold",
                              state.kind === "overdue" && "bg-overdue-bg text-overdue",
                              (state.kind === "today" || state.kind === "soon") && "bg-info-bg text-info",
                              state.kind === "later" && "bg-surface text-muted",
                            )}
                          >
                            {dueStateLabel(state)}
                          </span>
                          {plan.assignee_id ? <span>· {names.get(plan.assignee_id) ?? "Ex-membro"}</span> : null}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 text-sm">
                        {isWorkOrderPriority(plan.priority) ? <PriorityIndicator priority={plan.priority} /> : null}
                        {canManage ? <span className="text-xs text-muted">Editar</span> : null}
                      </span>
                    </summary>

                    {open ? (
                      <p className="mt-3 flex items-center gap-2 text-sm">
                        Ordem em aberto:
                        <Link href={`/e/${establishmentId}/ocorrencias/${open.number}`} className="font-semibold underline underline-offset-4">
                          #{String(open.number).padStart(4, "0")}
                        </Link>
                        {isWorkOrderStatus(open.status) ? <StatusBadge status={open.status} /> : null}
                      </p>
                    ) : null}

                    {canManage ? (
                      <div className="mt-4 flex flex-col gap-4 rounded-[var(--radius-control)] bg-surface p-4">
                        <ActionForm action={savePlan.bind(null, establishmentId)} className="flex flex-col gap-4">
                          <PlanFields values={plan} {...options} />
                          <SubmitButton size="sm" className="self-start" pendingLabel="Guardando…">
                            Guardar plano
                          </SubmitButton>
                        </ActionForm>
                        <ActionForm action={planAction.bind(null, establishmentId)} className="flex flex-wrap gap-2">
                          <input type="hidden" name="id" value={plan.id} />
                          <Button type="submit" name="intent" value="pause" variant="secondary" size="sm">
                            Pausar plano
                          </Button>
                          <ConfirmButton
                            name="intent"
                            value="delete"
                            variant="ghost"
                            size="sm"
                            className="text-critical"
                            confirmText={`Excluir o plano "${plan.title}"? As ordens já geradas continuam no histórico.`}
                          >
                            Excluir
                          </ConfirmButton>
                        </ActionForm>
                      </div>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {paused.length > 0 ? (
        <section className="flex flex-col gap-4" aria-labelledby="pausados">
          <h2 id="pausados" className={sectionTitle}>
            Pausados ({paused.length})
          </h2>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {paused.map((plan) => (
              <li key={plan.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-muted">
                <span>
                  {plan.title} · {paths.get(plan.location_id)}
                </span>
                {canManage ? (
                  <ActionForm action={planAction.bind(null, establishmentId)} className="flex gap-2">
                    <input type="hidden" name="id" value={plan.id} />
                    <Button type="submit" name="intent" value="resume" variant="secondary" size="sm">
                      Reativar
                    </Button>
                  </ActionForm>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManage ? (
        <section className="flex flex-col gap-4" aria-labelledby="novo-plano">
          <h2 id="novo-plano" className={sectionTitle}>
            Novo plano
          </h2>
          {options.locations.length === 0 ? (
            <p className="text-sm text-muted">Cadastre primeiro os locais em Configurações.</p>
          ) : (
            <ActionForm action={savePlan.bind(null, establishmentId)} className="flex flex-col gap-4">
              <PlanFields {...options} />
              <SubmitButton className="self-start" pendingLabel="Criando…">
                Criar plano
              </SubmitButton>
            </ActionForm>
          )}
        </section>
      ) : null}
    </div>
  );
}
