import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarList } from "@/components/dashboard/bar-list";
import { StatGrid, StatTile } from "@/components/dashboard/stat-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OverdueBadge, PriorityIndicator, StatusBadge } from "@/components/work-orders/indicators";
import { WORK_ORDER_PRIORITIES, WORK_ORDER_STATUSES } from "@/lib/domain/work-orders";

export const metadata: Metadata = { title: "UI kit" };

/** Vitrine de componentes para revisão visual. Não existe em produção. */
export default function UiKitPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-16 px-[clamp(24px,4.4vw,72px)] py-16">
      <header className="flex flex-col gap-2 border-b border-line pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Fundação</p>
        <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">UI kit</h1>
        <p className="text-sm text-muted">Tokens e componentes base. Os dados abaixo são exemplos, não dados reais.</p>
      </header>

      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Nova ocorrência</Button>
          <Button variant="secondary">Atribuir</Button>
          <Button variant="ghost">Cancelar</Button>
          <Button variant="danger">Cancelar ocorrência</Button>
          <Button disabled>Desativado</Button>
          <Button size="lg">Concluir serviço</Button>
        </div>
      </Section>

      <Section title="Prioridades">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          {WORK_ORDER_PRIORITIES.map((priority) => (
            <PriorityIndicator key={priority} priority={priority} />
          ))}
        </div>
      </Section>

      <Section title="Estados">
        <div className="flex flex-wrap items-center gap-2">
          {WORK_ORDER_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
          <OverdueBadge />
        </div>
      </Section>

      <Section title="Formulário">
        <div className="grid max-w-md gap-4">
          <Input label="Título" placeholder="Ex.: Banheira com vazamento" />
          <Input label="Local" placeholder="Buscar suíte, quarto ou área" hint="Digite o número ou o nome do local." />
          <Input label="E-mail" type="email" defaultValue="nome@" error="Informe um e-mail válido." />
        </div>
      </Section>

      <Section title="Painel (exemplo, dados fictícios)">
        <StatGrid label="Exemplo">
          <StatTile label="Abertas" value={12} />
          <StatTile label="Críticas" value={2} tone="critical" />
          <StatTile label="Atrasadas" value={3} tone="overdue" />
          <StatTile label="Em andamento" value={4} />
          <StatTile label="Tempo médio de resolução" value="1 d 6 h" hint="Mediana 20 h · 14 concluídas" />
          <StatTile label="Concluídas no prazo" value="86%" hint="12 de 14" />
        </StatGrid>
        <div className="max-w-xl">
          <BarList
            valueLabel="Exemplo por setor"
            emptyText=""
            items={[
              { key: "a", label: "Bloco A", value: 7, detail: "2 atrasada(s) · 9 concluída(s) no período" },
              { key: "b", label: "Bloco B", value: 3, detail: "4 concluída(s) no período" },
              { key: "t", label: "Área técnica", value: 1 },
            ]}
          />
        </div>
      </Section>

      <Section title="Cartão de ocorrência (exemplo)">
        <article className="flex max-w-xl flex-col gap-3 rounded-[var(--radius-control)] border border-line p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">#0042 · Bloco A › Suíte 12</span>
              <h3 className="text-lg font-[550] tracking-[-0.02em]">Banheira de hidromassagem com vazamento</h3>
            </div>
            <PriorityIndicator priority="critical" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusBadge status="in_progress" />
            <OverdueBadge />
            <span>· João · há 3 h</span>
          </div>
        </article>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">{title}</h2>
      {children}
    </section>
  );
}
