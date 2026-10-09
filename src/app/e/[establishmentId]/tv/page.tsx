import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireEstablishment } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { DISPLAY_LAYOUTS, OPEN_STATUSES, parseDisplayConfig, type DisplayConfig } from "@/lib/display/config";
import { PRIORITY_LABELS, STATUS_LABELS, WORK_ORDER_PRIORITIES } from "@/lib/domain/work-orders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadStructure } from "../configuracoes/data";
import { displayAction, pairTv, revokeTv, saveDisplay } from "./actions";

export const metadata: Metadata = { title: "TV" };

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default function TvPage({ params }: PageProps<"/e/[establishmentId]/tv">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <Tv params={params} />
    </Suspense>
  );
}

async function Tv({ params }: Pick<PageProps<"/e/[establishmentId]/tv">, "params">) {
  const { establishmentId } = await params;
  const { can } = await requireEstablishment(establishmentId);
  if (!can("displays.manage")) notFound();

  const supabase = await createSupabaseServerClient();
  const [{ data: displays }, { data: devices }, { locations }] = await Promise.all([
    supabase.from("displays").select("id, name, config, active").eq("establishment_id", establishmentId).order("created_at"),
    supabase
      .from("display_devices")
      .select("id, display_id, name, last_seen_at, expires_at, revoked_at, created_at")
      .eq("establishment_id", establishmentId)
      .is("revoked_at", null)
      .order("created_at"),
    loadStructure(establishmentId),
  ]);

  const sectors = locations.filter((l) => l.parentId === null).map((l) => ({ id: l.id, name: l.name }));
  const displayName = new Map((displays ?? []).map((d) => [d.id, d.name]));
  const activeDisplays = (displays ?? []).filter((d) => d.active);
  const now = new Date();
  const appUrlHint = "maintenance-m-hotel.vercel.app/display";

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">TV</h1>
        <p className="max-w-[70ch] text-sm text-muted">
          Na TV, abra <code className="text-ink">{appUrlHint}</code> no navegador (de preferência num stick Android TV com
          navegador em modo quiosque). Aparece um código: digite-o abaixo. A TV só mostra o painel escolhido e nunca tem
          acesso administrativo.
        </p>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="parear">
        <h2 id="parear" className={sectionTitle}>
          Parear TV
        </h2>
        {activeDisplays.length === 0 ? (
          <p className="text-sm text-muted">Crie primeiro um painel (abaixo).</p>
        ) : (
          <ActionForm action={pairTv.bind(null, establishmentId)} className="grid max-w-3xl gap-4 sm:grid-cols-3">
            <Input label="Código da TV" name="code" placeholder="ABC-234" autoComplete="off" autoCapitalize="characters" required />
            <Select label="Painel" name="display_id" defaultValue={activeDisplays[0]?.id}>
              {activeDisplays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Input label="Nome da TV" name="name" placeholder="TV da manutenção" required />
            <div className="sm:col-span-3">
              <SubmitButton pendingLabel="Pareando…">Parear</SubmitButton>
            </div>
          </ActionForm>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="tvs">
        <h2 id="tvs" className={sectionTitle}>
          TVs pareadas ({devices?.length ?? 0})
        </h2>
        {devices?.length ? (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {devices.map((d) => {
              const online = d.last_seen_at && now.getTime() - new Date(d.last_seen_at).getTime() < 3 * 60_000;
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">{d.name}</span>
                    <span className="text-xs text-muted">
                      {displayName.get(d.display_id)} · válida até {dateTime.format(new Date(d.expires_at))} (renova sozinha com uso)
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={cn("flex items-center gap-1.5 text-xs", online ? "text-success" : "text-muted")}>
                      <span className={cn("h-2 w-2 rounded-full", online ? "bg-success" : "bg-line")} aria-hidden />
                      {online ? "Online" : d.last_seen_at ? `Visto ${dateTime.format(new Date(d.last_seen_at))}` : "Nunca conectou"}
                    </span>
                    <ActionForm action={revokeTv.bind(null, establishmentId)} className="flex">
                      <input type="hidden" name="id" value={d.id} />
                      <ConfirmButton variant="ghost" size="sm" className="text-critical" confirmText={`Revogar o acesso de "${d.name}"?`}>
                        Revogar
                      </ConfirmButton>
                    </ActionForm>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border-y border-line py-6 text-sm text-muted">Nenhuma TV pareada.</p>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="paineis">
        <h2 id="paineis" className={sectionTitle}>
          Painéis
        </h2>
        <p className="max-w-[70ch] text-sm text-muted">
          Um painel define o que a TV mostra. Sem escolhas, mostra tudo o que está aberto. Críticas e atrasadas ficam
          sempre visíveis; o resto alterna em páginas.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {(displays ?? []).map((d) => (
            <div key={d.id} className={cn("flex flex-col gap-4 rounded-[var(--radius-control)] border border-line p-5", !d.active && "opacity-60")}>
              <ActionForm action={saveDisplay.bind(null, establishmentId)} className="flex flex-col gap-4">
                <DisplayFields id={d.id} name={d.name} config={parseDisplayConfig(d.config)} sectors={sectors} />
                <SubmitButton variant="secondary" size="sm" className="self-start" pendingLabel="Guardando…">
                  Guardar painel
                </SubmitButton>
              </ActionForm>
              <ActionForm action={displayAction.bind(null, establishmentId)} className="flex flex-wrap gap-2 border-t border-line pt-4">
                <input type="hidden" name="id" value={d.id} />
                <Button type="submit" name="intent" value={d.active ? "deactivate" : "activate"} variant="ghost" size="sm">
                  {d.active ? "Desativar painel" : "Reativar painel"}
                </Button>
                <ConfirmButton
                  name="intent"
                  value="delete"
                  variant="ghost"
                  size="sm"
                  className="text-critical"
                  confirmText={`Excluir o painel "${d.name}"? As TVs ligadas a ele perdem o acesso.`}
                >
                  Excluir
                </ConfirmButton>
              </ActionForm>
            </div>
          ))}
          <div className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-dashed border-line p-5">
            <ActionForm action={saveDisplay.bind(null, establishmentId)} className="flex flex-col gap-4">
              <DisplayFields name="" config={parseDisplayConfig({})} sectors={sectors} />
              <SubmitButton size="sm" className="self-start" pendingLabel="Criando…">
                Criar painel
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      </section>
    </div>
  );
}

function DisplayFields({
  id,
  name,
  config,
  sectors,
}: {
  id?: string;
  name: string;
  config: DisplayConfig;
  sectors: { id: string; name: string }[];
}) {
  const check = "mt-0.5 accent-[var(--ink)]";
  return (
    <>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <Input label={id ? "Nome do painel" : "Novo painel"} name="name" defaultValue={name} placeholder="Ex.: Sala de manutenção" required />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold">Setores (nenhum marcado = todos)</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {sectors.length === 0 ? <span className="text-sm text-muted">Sem setores cadastrados.</span> : null}
          {sectors.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="sector_ids" value={s.id} defaultChecked={config.sectorIds.includes(s.id)} className={check} />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold">Prioridades</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {WORK_ORDER_PRIORITIES.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="priorities" value={p} defaultChecked={config.priorities.includes(p)} className={check} />
              {PRIORITY_LABELS[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold">Estados</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {OPEN_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="statuses" value={s} defaultChecked={config.statuses.includes(s)} className={check} />
              {STATUS_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Layout" name="layout" defaultValue={config.layout}>
          {Object.entries(DISPLAY_LAYOUTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input label="Troca de página (segundos)" name="rotation_seconds" type="number" min={6} max={60} defaultValue={config.rotationSeconds} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="show_assignee" defaultChecked={config.showAssignee} className={check} />
          Mostrar responsável (só o primeiro nome)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="show_establishment" defaultChecked={config.showEstablishment} className={check} />
          Mostrar nome do estabelecimento
        </label>
      </div>
    </>
  );
}
