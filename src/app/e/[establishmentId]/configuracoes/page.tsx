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
import { buildLocationTree, descendantIds, flattenTree } from "@/lib/domain/locations";
import {
  applyTemplate,
  deleteLocationType,
  locationAction,
  saveLocation,
  saveLocationType,
} from "./actions";
import { loadStructure } from "./data";
import { SettingsHeader } from "./settings-nav";

export const metadata: Metadata = { title: "Locais" };

const sectionTitle = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";

export default function LocationsSettingsPage({ params }: PageProps<"/e/[establishmentId]/configuracoes">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <LocationsSettings params={params} />
    </Suspense>
  );
}

async function LocationsSettings({ params }: Pick<PageProps<"/e/[establishmentId]/configuracoes">, "params">) {
  const { establishmentId } = await params;
  const { establishment, can } = await requireEstablishment(establishmentId);
  if (!can("settings.manage")) notFound();

  const { types, categories, locations, paths } = await loadStructure(establishmentId);
  const tree = flattenTree(buildLocationTree(locations));
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const isEmpty = types.length === 0 && categories.length === 0 && locations.length === 0;

  const parentOptions = (excludeFrom?: string) => {
    const excluded = excludeFrom ? descendantIds(locations, excludeFrom) : new Set<string>();
    return tree.filter((l) => !excluded.has(l.id)).map((l) => ({ id: l.id, label: paths.get(l.id) ?? l.name }));
  };

  return (
    <div className="flex flex-col gap-14">
      <SettingsHeader establishmentId={establishmentId} active="Locais" />

      {isEmpty ? (
        <section className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-line p-6" aria-labelledby="modelo">
          <h2 id="modelo" className="text-lg font-[550] tracking-[-0.02em]">
            Começar com um modelo
          </h2>
          <p className="max-w-[60ch] text-sm text-muted">
            O modelo só cria tipos de local e categorias comuns. Você pode renomear, apagar ou acrescentar depois. Os locais
            (blocos, suítes, quartos) você cadastra abaixo.
          </p>
          <ActionForm action={applyTemplate.bind(null, establishmentId)} className="flex flex-wrap gap-3">
            <SubmitButton name="template" value={establishment.kind === "hotel" ? "hotel" : "motel"} pendingLabel="Aplicando…">
              Usar modelo {establishment.kind === "hotel" ? "Hotel" : "Motel"}
            </SubmitButton>
            <Button type="submit" name="template" value={establishment.kind === "hotel" ? "motel" : "hotel"} variant="secondary">
              Usar modelo {establishment.kind === "hotel" ? "Motel" : "Hotel"}
            </Button>
          </ActionForm>
        </section>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="novo-local">
        <h2 id="novo-local" className={sectionTitle}>
          Adicionar local
        </h2>
        <ActionForm action={saveLocation.bind(null, establishmentId)} className="grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Nome" name="name" placeholder="Ex.: Suíte 12" required />
          <Select label="Tipo" name="location_type_id" defaultValue="">
            <option value="">Sem tipo</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select label="Dentro de" name="parent_id" defaultValue="" hint="Vazio = setor principal.">
            <option value="">— Nível principal —</option>
            {parentOptions().map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input label="Código (opcional)" name="code" placeholder="Ex.: S12" />
          <div className="sm:col-span-2 lg:col-span-4">
            <SubmitButton pendingLabel="Adicionando…">Adicionar local</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="locais">
        <h2 id="locais" className={sectionTitle}>
          Locais ({locations.length})
        </h2>
        {tree.length === 0 ? (
          <p className="border-y border-line py-6 text-sm text-muted">
            Nenhum local ainda. Comece pelos setores principais (ex.: Bloco A, Área técnica) e depois adicione o que fica
            dentro de cada um.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {tree.map((node) => (
              <li key={node.id} className="py-3" style={{ paddingLeft: `${node.depth * 24}px` }}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span className={cn("flex min-w-0 items-baseline gap-2", !node.active && "text-muted")}>
                      {node.depth > 0 ? <span aria-hidden className="text-muted">└</span> : null}
                      <span className={cn("truncate", node.depth === 0 && "font-semibold")}>{node.name}</span>
                      {node.typeId ? <span className="text-xs text-muted">{typeName.get(node.typeId)}</span> : null}
                      {node.code ? <span className="text-xs tabular-nums text-muted">· {node.code}</span> : null}
                      {!node.active ? <span className="text-xs">· desativado</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted group-open:hidden">Editar</span>
                    <span className="hidden shrink-0 text-xs text-muted group-open:inline">Fechar</span>
                  </summary>

                  <div className="mt-4 flex flex-col gap-4 rounded-[var(--radius-control)] bg-surface p-4">
                    <ActionForm action={saveLocation.bind(null, establishmentId)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <input type="hidden" name="id" value={node.id} />
                      <Input label="Nome" name="name" defaultValue={node.name} required />
                      <Select label="Tipo" name="location_type_id" defaultValue={node.typeId ?? ""}>
                        <option value="">Sem tipo</option>
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                      <Select label="Dentro de" name="parent_id" defaultValue={node.parentId ?? ""}>
                        <option value="">— Nível principal —</option>
                        {parentOptions(node.id).map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <Input label="Código" name="code" defaultValue={node.code ?? ""} />
                      <div className="sm:col-span-2 lg:col-span-4">
                        <SubmitButton size="sm" pendingLabel="Guardando…">
                          Guardar
                        </SubmitButton>
                      </div>
                    </ActionForm>
                    <ActionForm action={locationAction.bind(null, establishmentId)} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={node.id} />
                      <Button type="submit" name="intent" value={node.active ? "deactivate" : "activate"} variant="secondary" size="sm">
                        {node.active ? "Desativar" : "Reativar"}
                      </Button>
                      <ConfirmButton
                        name="intent"
                        value="delete"
                        variant="ghost"
                        size="sm"
                        className="text-critical"
                        confirmText={`Excluir ${node.name}? Só é possível se não houver nada ligado a ele.`}
                      >
                        Excluir
                      </ConfirmButton>
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="tipos">
        <div className="flex flex-col gap-1">
          <h2 id="tipos" className={sectionTitle}>
            Tipos de local
          </h2>
          <p className="text-sm text-muted">Os nomes que este estabelecimento usa: Suíte, Quarto, Bloco, Andar…</p>
        </div>
        <ul className="flex max-w-2xl flex-col divide-y divide-line border-y border-line">
          {types.map((t) => (
            <li key={t.id} className="flex flex-wrap items-end gap-2 py-3">
              <ActionForm action={saveLocationType.bind(null, establishmentId)} className="flex flex-1 flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={t.id} />
                <Input label="Nome" name="name" defaultValue={t.name} className="flex-1" required />
                <SubmitButton variant="secondary" size="sm" className="mb-1" pendingLabel="…">
                  Renomear
                </SubmitButton>
              </ActionForm>
              <ActionForm action={deleteLocationType.bind(null, establishmentId)}>
                <input type="hidden" name="id" value={t.id} />
                <ConfirmButton variant="ghost" size="sm" className="mb-1 text-critical" confirmText={`Apagar o tipo ${t.name}?`}>
                  Apagar
                </ConfirmButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={saveLocationType.bind(null, establishmentId)} className="flex max-w-2xl flex-wrap items-end gap-2">
          <Input label="Novo tipo" name="name" placeholder="Ex.: Área de lazer" className="flex-1" required />
          <SubmitButton size="sm" className="mb-1" pendingLabel="…">
            Adicionar
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
