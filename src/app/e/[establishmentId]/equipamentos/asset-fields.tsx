import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ASSET_STATUSES, ASSET_STATUS_LABELS } from "@/lib/domain/assets";

export type AssetFormValues = {
  id?: string;
  name?: string;
  location_id?: string;
  category_id?: string | null;
  internal_code?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  installed_on?: string | null;
  warranty_until?: string | null;
  operational_status?: string;
  notes?: string | null;
};

/** Campos do formulário de equipamento (cadastro e edição). */
export function AssetFields({
  values = {},
  locations,
  categories,
}: {
  values?: AssetFormValues;
  locations: { id: string; label: string }[];
  categories: { id: string; name: string }[];
}) {
  return (
    <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <Input label="Nome" name="name" defaultValue={values.name} placeholder="Ex.: Banheira de hidromassagem" required />
      <Input label="Código interno (opcional)" name="internal_code" defaultValue={values.internal_code ?? ""} placeholder="Ex.: HID-012" />
      <Select label="Local" name="location_id" defaultValue={values.location_id ?? ""} required>
        <option value="" disabled>
          Escolha o local
        </option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </Select>
      <Select label="Categoria" name="category_id" defaultValue={values.category_id ?? ""}>
        <option value="">Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input label="Fabricante" name="manufacturer" defaultValue={values.manufacturer ?? ""} />
      <Input label="Modelo" name="model" defaultValue={values.model ?? ""} />
      <Input label="Data de instalação" name="installed_on" type="date" defaultValue={values.installed_on ?? ""} />
      <Input label="Garantia até" name="warranty_until" type="date" defaultValue={values.warranty_until ?? ""} />
      <Select label="Estado" name="operational_status" defaultValue={values.operational_status ?? "operational"}>
        {ASSET_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ASSET_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="asset-notes" className="text-xs font-semibold">
          Observações
        </label>
        <textarea
          id="asset-notes"
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={values.notes ?? ""}
          className="rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 text-sm focus:border-ink"
        />
      </div>
    </div>
  );
}
