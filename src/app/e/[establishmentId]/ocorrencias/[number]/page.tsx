import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { OverdueBadge, PriorityIndicator, StatusBadge } from "@/components/work-orders/indicators";
import { requireEstablishment, requireUser } from "@/lib/auth/session";
import { buildLocationTree, flattenTree } from "@/lib/domain/locations";
import {
  isClosed,
  isOverdue,
  isWorkOrderPriority,
  isWorkOrderStatus,
  PRIORITY_LABELS,
  STATUS_LABELS,
  WORK_ORDER_PRIORITIES,
} from "@/lib/domain/work-orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadStructure } from "../../configuracoes/data";
import { addComment, addItem, removeItem, updateWorkOrder } from "../actions";
import { loadTeam } from "../data";
import { AddPhotos, WorkOrderActions } from "./work-order-actions";

export const metadata: Metadata = { title: "Ocorrência" };

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function WorkOrderPage({ params }: PageProps<"/e/[establishmentId]/ocorrencias/[number]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando ocorrência…</p>}>
      <WorkOrder params={params} />
    </Suspense>
  );
}

async function WorkOrder({ params }: Pick<PageProps<"/e/[establishmentId]/ocorrencias/[number]">, "params">) {
  const { establishmentId, number: numberParam } = await params;
  const number = Number(numberParam);
  if (!Number.isInteger(number) || number <= 0) notFound();

  const { can } = await requireEstablishment(establishmentId);
  const me = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data: wo } = await supabase
    .from("work_orders")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("number", number)
    .maybeSingle();
  if (!wo || !isWorkOrderStatus(wo.status) || !isWorkOrderPriority(wo.priority)) notFound();
  const status = wo.status;

  const [structure, team, items, comments, attachments, timeline, asset] = await Promise.all([
    loadStructure(establishmentId),
    loadTeam(establishmentId),
    supabase.rpc("work_order_items_for", { p_work_order_id: wo.id }),
    supabase.from("work_order_comments").select("id, author_id, body, created_at").eq("work_order_id", wo.id).order("created_at"),
    supabase.from("attachments").select("id, phase, storage_path, created_at").eq("work_order_id", wo.id).order("created_at"),
    supabase.rpc("work_order_timeline", { p_work_order_id: wo.id }),
    wo.asset_id ? supabase.from("assets").select("id, name").eq("id", wo.asset_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Fotos: links assinados válidos por 1 hora (o armazenamento é privado).
  const paths = (attachments.data ?? []).map((a) => a.storage_path);
  const signed = paths.length ? await supabase.storage.from("work-orders").createSignedUrls(paths, 3600) : { data: [] };
  const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  const now = new Date();
  const names = new Map(team.map((m) => [m.id, m.name]));
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? "Ex-membro") : "—");
  const dueAt = wo.due_at ? new Date(wo.due_at) : null;
  const overdue = isOverdue({ status, dueAt }, now);
  // Fuso do piloto (Brasil). O fuso por estabelecimento já existe no banco e entra quando houver clientes noutros fusos.
  const tz = "America/Sao_Paulo";
  const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: tz });

  const isAssignee = wo.assignee_id === me.id;
  const canManage = can("work_orders.manage");
  const canExecute = can("work_orders.execute");
  const open = !isClosed(status);
  const canAttach = status !== "cancelled" && (wo.reported_by === me.id || isAssignee || canManage);
  const canEdit = open && (canManage || (wo.reported_by === me.id && (status === "pending" || status === "assigned")));
  const canAddItems = status !== "cancelled" && (canManage || isAssignee);
  const categoryName = structure.categories.find((c) => c.id === wo.category_id)?.name;

  const itemsData = items.data ?? [];
  const materialsTotal = itemsData.reduce((sum, i) => sum + (i.unit_cost ?? 0) * Number(i.quantity), 0);
  const showCosts = can("costs.read");

  // Atividade: comentários + eventos de estado/atribuição/prioridade, em ordem.
  type Activity = { at: Date; who: string; text: string; kind: "comment" | "event" };
  const activity: Activity[] = [
    ...(comments.data ?? []).map((c) => ({ at: new Date(c.created_at), who: nameOf(c.author_id), text: c.body, kind: "comment" as const })),
    ...(timeline.data ?? []).flatMap((e): Activity[] => describeEvent(e, nameOf).map((text) => ({ at: new Date(e.at), who: e.actor_name, text, kind: "event" as const }))),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const base = `/e/${establishmentId}/ocorrencias`;
  const locationOptions = flattenTree(buildLocationTree(structure.locations.filter((l) => l.active || l.id === wo.location_id))).map((l) => ({
    id: l.id,
    label: structure.paths.get(l.id) ?? l.name,
  }));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <Link href={base} className="text-sm text-muted hover:text-ink">
          ← Ocorrências
        </Link>
        <p className="text-sm font-semibold text-muted">
          #{String(wo.number).padStart(4, "0")} · {structure.paths.get(wo.location_id)}
          {asset.data ? ` · ${asset.data.name}` : ""}
        </p>
        <h1 className="text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.1] font-[550] tracking-[-0.04em]">{wo.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <PriorityIndicator priority={wo.priority} />
          <StatusBadge status={status} />
          {overdue ? <OverdueBadge /> : null}
          {status === "on_hold" && wo.hold_reason ? <span className="text-muted">Aguardando: {wo.hold_reason}</span> : null}
        </div>
      </header>

      <dl className="grid max-w-3xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">Responsável</dt>
        <dd>{wo.assignee_id ? nameOf(wo.assignee_id) : "Sem responsável"}</dd>
        <dt className="text-muted">Aberta por</dt>
        <dd>
          {wo.source === "preventive" ? "Plano preventivo" : nameOf(wo.reported_by)} · {dateTime.format(new Date(wo.opened_at))}
        </dd>
        <dt className="text-muted">Prazo</dt>
        <dd className={overdue ? "font-semibold text-overdue" : undefined}>{dueAt ? dateTime.format(dueAt) : "Sem prazo"}</dd>
        {categoryName ? (
          <>
            <dt className="text-muted">Categoria</dt>
            <dd>{categoryName}</dd>
          </>
        ) : null}
        {wo.started_at ? (
          <>
            <dt className="text-muted">Iniciada</dt>
            <dd>{dateTime.format(new Date(wo.started_at))}</dd>
          </>
        ) : null}
        {wo.completed_at ? (
          <>
            <dt className="text-muted">Concluída</dt>
            <dd>{dateTime.format(new Date(wo.completed_at))}</dd>
          </>
        ) : null}
        {wo.description ? (
          <>
            <dt className="text-muted">Detalhes</dt>
            <dd className="whitespace-pre-line">{wo.description}</dd>
          </>
        ) : null}
        {wo.completion_summary ? (
          <>
            <dt className="text-muted">Serviço executado</dt>
            <dd className="whitespace-pre-line">{wo.completion_summary}</dd>
          </>
        ) : null}
        {wo.cancellation_reason ? (
          <>
            <dt className="text-muted">Cancelada</dt>
            <dd className="whitespace-pre-line">{wo.cancellation_reason}</dd>
          </>
        ) : null}
      </dl>

      <WorkOrderActions
        establishmentId={establishmentId}
        workOrder={{ id: wo.id, number: wo.number, status, assigneeId: wo.assignee_id }}
        assignees={team.filter((m) => m.canExecute).map((m) => ({ id: m.id, name: m.name }))}
        permissions={{
          canStart: canManage || (canExecute && (isAssignee || !wo.assignee_id)),
          startLabel: wo.assignee_id && !isAssignee ? "Iniciar" : wo.assignee_id ? "Iniciar serviço" : "Assumir e iniciar",
          canWork: canManage || isAssignee,
          canCancel: canManage,
          canAssign: can("work_orders.assign"),
          canWriteCosts: can("costs.write"),
          canAttach,
        }}
      />

      <section className="flex flex-col gap-4" aria-labelledby="fotos">
        <h2 id="fotos" className={sectionTitle}>
          Fotos ({paths.length})
        </h2>
        {paths.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {(attachments.data ?? []).map((a) => {
              const url = urlByPath.get(a.storage_path);
              return (
                <li key={a.id} className="flex flex-col gap-1">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-[var(--radius-control)] bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Foto ${a.phase === "completion" ? "do resultado" : "da ocorrência"}`} className="h-full w-full object-cover" loading="lazy" />
                    </a>
                  ) : null}
                  <span className="text-xs text-muted">{a.phase === "completion" ? "Resultado" : a.phase === "progress" ? "Durante" : "Abertura"}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhuma foto.</p>
        )}
        {canAttach ? <AddPhotos establishmentId={establishmentId} workOrder={{ id: wo.id, number: wo.number }} /> : null}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="materiais">
        <h2 id="materiais" className={sectionTitle}>
          Materiais{showCosts ? " e custos" : ""}
        </h2>
        {itemsData.length ? (
          <ul className="flex max-w-3xl flex-col divide-y divide-line border-y border-line text-sm">
            {itemsData.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 py-2">
                <span>
                  {Number(i.quantity).toLocaleString("pt-BR")} × {i.description}
                  <span className="ml-2 text-xs text-muted">{i.created_by_name}</span>
                </span>
                <span className="flex items-center gap-3">
                  {showCosts && i.unit_cost != null ? <span className="tabular-nums">{money.format(i.unit_cost * Number(i.quantity))}</span> : null}
                  {canManage || i.created_by === me.id ? (
                    <ActionForm action={removeItem.bind(null, establishmentId)} className="flex">
                      <input type="hidden" name="item_id" value={i.id} />
                      <input type="hidden" name="number" value={wo.number} />
                      <ConfirmButton variant="ghost" size="sm" confirmText="Remover este material?" aria-label={`Remover ${i.description}`}>
                        ×
                      </ConfirmButton>
                    </ActionForm>
                  ) : null}
                </span>
              </li>
            ))}
            {showCosts && (materialsTotal > 0 || wo.labor_cost) ? (
              <li className="flex justify-between py-2 font-semibold">
                <span>Total{wo.labor_cost ? " (materiais + mão de obra)" : ""}</span>
                <span className="tabular-nums">{money.format(materialsTotal + Number(wo.labor_cost ?? 0))}</span>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nenhum material registrado.</p>
        )}
        {canAddItems ? (
          <ActionForm action={addItem.bind(null, establishmentId)} className="flex max-w-3xl flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={wo.id} />
            <input type="hidden" name="number" value={wo.number} />
            <Input label="Material" name="description" placeholder="Ex.: Vedação de silicone" className="min-w-48 flex-1" required />
            <Input label="Qtd." name="quantity" inputMode="decimal" defaultValue="1" className="w-20" />
            {can("costs.write") ? <Input label="Valor unit. (R$)" name="unit_cost" inputMode="decimal" placeholder="0,00" className="w-32" /> : null}
            <SubmitButton variant="secondary" pendingLabel="…" className="mb-px">
              Adicionar
            </SubmitButton>
          </ActionForm>
        ) : null}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="atividade">
        <h2 id="atividade" className={sectionTitle}>
          Histórico e observações
        </h2>
        <ol className="flex max-w-3xl flex-col gap-3 border-l border-line pl-4">
          {activity.map((a, index) => (
            <li key={index} className="flex flex-col text-sm">
              <span className="text-xs text-muted">
                {dateTime.format(a.at)} · {a.who}
              </span>
              <span className={a.kind === "comment" ? "whitespace-pre-line" : "text-muted"}>{a.text}</span>
            </li>
          ))}
        </ol>
        <ActionForm action={addComment.bind(null, establishmentId)} className="flex max-w-3xl flex-col gap-2">
          <input type="hidden" name="id" value={wo.id} />
          <input type="hidden" name="number" value={wo.number} />
          <label htmlFor="comment" className="text-xs font-semibold">
            Nova observação
          </label>
          <textarea
            id="comment"
            name="body"
            rows={2}
            maxLength={2000}
            required
            className="rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 text-sm focus:border-ink"
          />
          <SubmitButton variant="secondary" size="sm" pendingLabel="…" className="self-start">
            Adicionar observação
          </SubmitButton>
        </ActionForm>
      </section>

      {canEdit ? (
        <details className="max-w-3xl rounded-[var(--radius-control)] border border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold">Editar dados da ocorrência</summary>
          <ActionForm action={updateWorkOrder.bind(null, establishmentId)} className="mt-4 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={wo.id} />
            <input type="hidden" name="number" value={wo.number} />
            <TimezoneOffsetInput />
            <Input label="Título" name="title" defaultValue={wo.title} className="sm:col-span-2" required />
            <Select label="Local" name="location_id" defaultValue={wo.location_id} required>
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
            <Select label="Prioridade" name="priority" defaultValue={wo.priority}>
              {WORK_ORDER_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
            <Select label="Categoria" name="category_id" defaultValue={wo.category_id ?? ""}>
              <option value="">Sem categoria</option>
              {structure.categories
                .filter((c) => c.active || c.id === wo.category_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
            <input type="hidden" name="asset_id" value={wo.asset_id ?? ""} />
            {canManage ? (
              <Input
                label="Prazo"
                name="due_at"
                type="datetime-local"
                defaultValue={dueAt ? toLocalInput(dueAt, tz) : ""}
              />
            ) : (
              <input type="hidden" name="due_at" value="" />
            )}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="edit-description" className="text-xs font-semibold">
                Detalhes
              </label>
              <textarea
                id="edit-description"
                name="description"
                rows={3}
                defaultValue={wo.description ?? ""}
                className="rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 text-sm focus:border-ink"
              />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Guardando…">Guardar alterações</SubmitButton>
            </div>
          </ActionForm>
        </details>
      ) : null}
    </div>
  );
}

/** Converte os eventos da auditoria em frases legíveis. */
function describeEvent(
  e: { action: string; changed_fields: string[] | null; before: unknown; after: unknown },
  nameOf: (id: string | null) => string,
): string[] {
  const after = (e.after ?? {}) as Record<string, string | null>;
  const before = (e.before ?? {}) as Record<string, string | null>;
  if (e.action === "work_orders.insert") return ["Abriu a ocorrência"];
  const changed = new Set(e.changed_fields ?? []);
  const out: string[] = [];
  if (changed.has("status") && after.status && isWorkOrderStatus(after.status)) {
    const hold = after.status === "on_hold" && after.hold_reason ? `: ${after.hold_reason}` : "";
    out.push(`Mudou para ${STATUS_LABELS[after.status]}${hold}`);
  }
  if (changed.has("assignee_id")) {
    out.push(after.assignee_id ? `Responsável: ${nameOf(after.assignee_id)}` : `Removeu o responsável ${nameOf(before.assignee_id ?? null)}`);
  }
  if (changed.has("priority") && after.priority && isWorkOrderPriority(after.priority)) {
    out.push(`Prioridade: ${PRIORITY_LABELS[after.priority]}`);
  }
  if (changed.has("due_at")) out.push("Alterou o prazo");
  if (out.length === 0 && changed.size > 0) out.push("Editou os dados");
  return out;
}

/** Valor para <input type="datetime-local"> no fuso do estabelecimento. */
function toLocalInput(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return parts.replace(" ", "T");
}

function TimezoneOffsetInput() {
  // America/Sao_Paulo não tem horário de verão desde 2019: UTC−3 (180 minutos).
  return <input type="hidden" name="tz_offset" value="180" />;
}
