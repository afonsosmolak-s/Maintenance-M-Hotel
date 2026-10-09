import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PRIORITY_LABELS, WORK_ORDER_PRIORITIES } from "@/lib/domain/work-orders";

type Option = { id: string; label: string };

export type PlanValues = {
  id?: string;
  title?: string;
  description?: string | null;
  location_id?: string;
  asset_id?: string | null;
  category_id?: string | null;
  priority?: string;
  assignee_id?: string | null;
  interval_unit?: string;
  interval_count?: number;
  next_due_on?: string;
  lead_days?: number;
};

/** Campos do plano preventivo (criação e edição). */
export function PlanFields({
  values = {},
  locations,
  assets,
  categories,
  assignees,
  today,
}: {
  values?: PlanValues;
  locations: Option[];
  assets: Option[];
  categories: Option[];
  assignees: Option[];
  today: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <Input label="Tarefa" name="title" defaultValue={values.title} placeholder="Ex.: Limpar filtros do ar-condicionado" className="sm:col-span-2" required />
      <Select label="Local" name="location_id" defaultValue={values.location_id ?? ""} className="sm:col-span-2" required>
        <option value="" disabled>
          Escolha o local
        </option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </Select>

      <div className="flex items-end gap-2 sm:col-span-2">
        <Input label="A cada" name="interval_count" type="number" min={1} max={365} defaultValue={values.interval_count ?? 1} className="w-24" required />
        <Select label="Periodicidade" name="interval_unit" defaultValue={values.interval_unit ?? "month"} className="flex-1">
          <option value="day">dia(s)</option>
          <option value="week">semana(s)</option>
          <option value="month">mês(es)</option>
        </Select>
      </div>
      <Input label="Próxima data" name="next_due_on" type="date" defaultValue={values.next_due_on ?? today} required />
      <Input
        label="Antecedência (dias)"
        name="lead_days"
        type="number"
        min={0}
        max={60}
        defaultValue={values.lead_days ?? 7}
        hint="A ordem aparece este nº de dias antes."
        required
      />

      <Select label="Prioridade" name="priority" defaultValue={values.priority ?? "medium"}>
        {WORK_ORDER_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </Select>
      <Select label="Responsável" name="assignee_id" defaultValue={values.assignee_id ?? ""}>
        <option value="">Definir quando gerar</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </Select>
      <Select label="Categoria" name="category_id" defaultValue={values.category_id ?? ""}>
        <option value="">Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
      <Select label="Equipamento" name="asset_id" defaultValue={values.asset_id ?? ""}>
        <option value="">Nenhum em específico</option>
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </Select>

      <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
        <label htmlFor={`plan-desc-${values.id ?? "new"}`} className="text-xs font-semibold">
          Instruções (opcional)
        </label>
        <textarea
          id={`plan-desc-${values.id ?? "new"}`}
          name="description"
          rows={2}
          maxLength={2000}
          defaultValue={values.description ?? ""}
          placeholder="O que verificar, materiais necessários…"
          className="rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 text-sm focus:border-ink"
        />
      </div>
    </div>
  );
}
