import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireEstablishment } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { categoryAction, saveCategory } from "../actions";
import { loadStructure } from "../data";
import { SettingsHeader } from "../settings-nav";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriesPage({ params }: PageProps<"/e/[establishmentId]/configuracoes/categorias">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
      <Categories params={params} />
    </Suspense>
  );
}

async function Categories({ params }: Pick<PageProps<"/e/[establishmentId]/configuracoes/categorias">, "params">) {
  const { establishmentId } = await params;
  const { can } = await requireEstablishment(establishmentId);
  if (!can("settings.manage")) notFound();
  const { categories } = await loadStructure(establishmentId);

  return (
    <div className="flex flex-col gap-14">
      <SettingsHeader establishmentId={establishmentId} active="Categorias" />

      <section className="flex flex-col gap-4" aria-labelledby="categorias">
        <div className="flex flex-col gap-1">
          <h2 id="categorias" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Categorias de manutenção ({categories.length})
          </h2>
          <p className="text-sm text-muted">Usadas para classificar ocorrências e equipamentos. Desativadas não aparecem em novos registros.</p>
        </div>

        <ul className="flex max-w-2xl flex-col divide-y divide-line border-y border-line">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-end gap-2 py-3">
              <ActionForm action={saveCategory.bind(null, establishmentId)} className="flex flex-1 flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={c.id} />
                <Input
                  label={c.active ? "Nome" : "Nome (desativada)"}
                  name="name"
                  defaultValue={c.name}
                  className={cn("flex-1", !c.active && "opacity-60")}
                  required
                />
                <SubmitButton variant="secondary" size="sm" className="mb-1" pendingLabel="…">
                  Renomear
                </SubmitButton>
              </ActionForm>
              <ActionForm action={categoryAction.bind(null, establishmentId)} className="flex flex-wrap gap-1">
                <input type="hidden" name="id" value={c.id} />
                <Button type="submit" name="intent" value={c.active ? "deactivate" : "activate"} variant="ghost" size="sm" className="mb-1">
                  {c.active ? "Desativar" : "Reativar"}
                </Button>
                <ConfirmButton
                  name="intent"
                  value="delete"
                  variant="ghost"
                  size="sm"
                  className="mb-1 text-critical"
                  confirmText={`Excluir a categoria ${c.name}?`}
                >
                  Excluir
                </ConfirmButton>
              </ActionForm>
            </li>
          ))}
        </ul>

        <ActionForm action={saveCategory.bind(null, establishmentId)} className="flex max-w-2xl flex-wrap items-end gap-2">
          <Input label="Nova categoria" name="name" placeholder="Ex.: Piscina" className="flex-1" required />
          <SubmitButton size="sm" className="mb-1" pendingLabel="…">
            Adicionar
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
