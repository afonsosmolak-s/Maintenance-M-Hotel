"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PriorityIndicator } from "@/components/work-orders/indicators";
import { PhotoPicker } from "@/components/work-orders/photo-picker";
import { cn } from "@/lib/cn";
import { descendantIds, type FlatLocation } from "@/lib/domain/locations";
import { WORK_ORDER_PRIORITIES, type WorkOrderPriority } from "@/lib/domain/work-orders";
import { uploadWorkOrderPhotos } from "@/lib/images/upload-work-order-photos";
import { createWorkOrder } from "../actions";

type Option = { id: string; label: string };

export function NewWorkOrderForm({
  establishmentId,
  locations,
  locationTree,
  assets,
  categories,
  assignees,
}: {
  establishmentId: string;
  locations: Option[];
  locationTree: FlatLocation[];
  assets: { id: string; name: string; locationId: string; categoryId: string | null }[];
  categories: Option[];
  /** Vazio quando quem abre não pode atribuir. */
  assignees: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [locationId, setLocationId] = useState("");
  const [priority, setPriority] = useState<WorkOrderPriority>("medium");
  const [categoryId, setCategoryId] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  // Equipamentos do local escolhido e dos locais dentro dele.
  const assetsHere = useMemo(() => {
    if (!locationId) return [];
    const scope = descendantIds(locationTree, locationId);
    return assets.filter((a) => scope.has(a.locationId));
  }, [assets, locationTree, locationId]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      setStatus("Abrindo ocorrência…");
      const result = await createWorkOrder(establishmentId, {
        title: form.get("title"),
        description: form.get("description"),
        locationId,
        assetId: form.get("asset_id"),
        categoryId,
        priority,
        assigneeId: form.get("assignee_id") ?? "",
      });
      if ("error" in result) {
        setStatus(null);
        setError(result.error);
        return;
      }

      if (photos.length > 0) {
        setStatus(`Enviando ${photos.length} foto(s)…`);
        const upload = await uploadWorkOrderPhotos(establishmentId, result.id, photos, "opening");
        if (upload.errors.length > 0) {
          // A ocorrência já existe: segue para ela e avisa das fotos que falharam.
          alert(`Ocorrência aberta, mas algumas fotos não foram enviadas:\n${upload.errors.join("\n")}`);
        }
      }
      router.push(`/e/${establishmentId}/ocorrencias/${result.number}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6">
      <Select label="Onde?" name="location_id" value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
        <option value="" disabled>
          Escolha o local
        </option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </Select>

      <Input label="O que aconteceu?" name="title" placeholder="Ex.: Banheira com vazamento" maxLength={120} required />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-semibold">Prioridade</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WORK_ORDER_PRIORITIES.map((p) => (
            <label
              key={p}
              className={cn(
                "flex h-12 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border text-sm transition-colors",
                priority === p ? "border-ink bg-surface" : "border-line hover:border-ink",
              )}
            >
              <input type="radio" name="priority" value={p} checked={priority === p} onChange={() => setPriority(p)} className="sr-only" />
              <PriorityIndicator priority={p} />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">Crítica: impede o uso do local ou é risco. O prazo é calculado pela prioridade.</p>
      </fieldset>

      <Select label="Categoria" name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
        <option value="">Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>

      {assetsHere.length > 0 ? (
        <Select label="Equipamento (opcional)" name="asset_id" defaultValue="">
          <option value="">Nenhum em específico</option>
          {assetsHere.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="wo-description" className="text-xs font-semibold">
          Detalhes (opcional)
        </label>
        <textarea
          id="wo-description"
          name="description"
          rows={3}
          maxLength={4000}
          placeholder="O que foi observado, desde quando, se o local pode ser usado…"
          className="rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 text-sm focus:border-ink"
        />
      </div>

      {assignees.length > 0 ? (
        <Select label="Responsável (opcional)" name="assignee_id" defaultValue="">
          <option value="">Definir depois</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      ) : null}

      <PhotoPicker files={photos} onChange={setPhotos} />

      <FormMessage state={error ? { error } : null} />
      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>
          {pending ? (status ?? "Aguarde…") : "Abrir ocorrência"}
        </Button>
      </div>
    </form>
  );
}
