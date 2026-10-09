"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { FormMessage, type FormState } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhotoPicker } from "@/components/work-orders/photo-picker";
import type { WorkOrderStatus } from "@/lib/domain/work-orders";
import { uploadWorkOrderPhotos } from "@/lib/images/upload-work-order-photos";
import { assignWorkOrder, refreshWorkOrder, transitionWorkOrder, transitionWorkOrderDirect } from "../actions";

export type ActionPermissions = {
  canStart: boolean;
  startLabel: string;
  canWork: boolean; // pausar, retomar, concluir
  canCancel: boolean;
  canAssign: boolean;
  canWriteCosts: boolean;
  canAttach: boolean;
};

type Panel = null | "hold" | "done" | "cancel";

/** Ações de estado da ocorrência, mostradas conforme o estado e a permissão de quem vê. */
export function WorkOrderActions({
  establishmentId,
  workOrder,
  permissions,
  assignees,
}: {
  establishmentId: string;
  workOrder: { id: string; number: number; status: WorkOrderStatus; assigneeId: string | null };
  permissions: ActionPermissions;
  assignees: { id: string; name: string }[];
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const action = transitionWorkOrder.bind(null, establishmentId);
  const hidden = (
    <>
      <input type="hidden" name="id" value={workOrder.id} />
      <input type="hidden" name="number" value={workOrder.number} />
    </>
  );
  const { status } = workOrder;
  const open = status !== "done" && status !== "cancelled";
  if (!open) return null;

  return (
    <section aria-label="Ações" className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-line p-4">
      <div className="flex flex-wrap gap-2">
        {permissions.canStart && (status === "pending" || status === "assigned") ? (
          <ActionForm action={action} className="contents">
            {hidden}
            <input type="hidden" name="to" value="in_progress" />
            <SubmitButton size="lg" pendingLabel="Iniciando…">
              {permissions.startLabel}
            </SubmitButton>
          </ActionForm>
        ) : null}
        {permissions.canWork && status === "on_hold" ? (
          <ActionForm action={action} className="contents">
            {hidden}
            <input type="hidden" name="to" value="in_progress" />
            <SubmitButton size="lg" pendingLabel="Retomando…">
              Retomar serviço
            </SubmitButton>
          </ActionForm>
        ) : null}
        {permissions.canWork && status === "in_progress" ? (
          <>
            <Button size="lg" onClick={() => setPanel(panel === "done" ? null : "done")}>
              Concluir
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setPanel(panel === "hold" ? null : "hold")}>
              Aguardando material
            </Button>
          </>
        ) : null}
        {permissions.canCancel ? (
          <Button size="lg" variant="ghost" className="text-critical" onClick={() => setPanel(panel === "cancel" ? null : "cancel")}>
            Cancelar ocorrência
          </Button>
        ) : null}
      </div>

      {panel === "hold" ? (
        <ActionForm action={action} className="flex flex-col gap-3">
          {hidden}
          <input type="hidden" name="to" value="on_hold" />
          <Input label="O que falta?" name="note" placeholder="Ex.: vedação encomendada, chega quinta" maxLength={500} required autoFocus />
          <SubmitButton variant="secondary" pendingLabel="Guardando…" className="self-start">
            Marcar como aguardando
          </SubmitButton>
        </ActionForm>
      ) : null}

      {panel === "done" ? (
        <ConcludeForm establishmentId={establishmentId} workOrder={workOrder} permissions={permissions} />
      ) : null}

      {panel === "cancel" ? (
        <ActionForm action={action} className="flex flex-col gap-3">
          {hidden}
          <input type="hidden" name="to" value="cancelled" />
          <Input label="Motivo do cancelamento" name="note" maxLength={1000} required autoFocus />
          <SubmitButton variant="danger" pendingLabel="Cancelando…" className="self-start">
            Confirmar cancelamento
          </SubmitButton>
        </ActionForm>
      ) : null}

      {permissions.canAssign ? (
        <ActionForm action={assignWorkOrder.bind(null, establishmentId)} className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
          {hidden}
          <Select label="Responsável" name="assignee_id" defaultValue={workOrder.assigneeId ?? ""} className="min-w-56">
            <option value="">Sem responsável</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <SubmitButton variant="secondary" pendingLabel="…">
            Atribuir
          </SubmitButton>
        </ActionForm>
      ) : null}
    </section>
  );
}

function ConcludeForm({
  establishmentId,
  workOrder,
  permissions,
}: {
  establishmentId: string;
  workOrder: { id: string; number: number };
  permissions: ActionPermissions;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<File[]>([]);
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      // Fotos primeiro: depois de concluída, a ocorrência continua a aceitar anexos, mas o normal é virem juntas.
      if (photos.length > 0 && permissions.canAttach) {
        const upload = await uploadWorkOrderPhotos(establishmentId, workOrder.id, photos, "completion");
        if (upload.errors.length > 0) {
          setState({ error: upload.errors.join(" ") });
          return;
        }
      }
      const result = await transitionWorkOrderDirect(establishmentId, {
        id: workOrder.id,
        number: workOrder.number,
        to: "done",
        note: form.get("note"),
        labor_cost: permissions.canWriteCosts ? form.get("labor_cost") : undefined,
      });
      setState(result);
      if (result?.success) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="conclude-note" className="text-xs font-semibold">
          O que foi feito?
        </label>
        <textarea
          id="conclude-note"
          name="note"
          rows={3}
          maxLength={4000}
          required
          autoFocus
          className="rounded-[var(--radius-control)] border border-line bg-paper px-3 py-2 text-sm focus:border-ink"
        />
      </div>
      {permissions.canWriteCosts ? (
        <Input label="Custo de mão de obra (R$, opcional)" name="labor_cost" inputMode="decimal" placeholder="0,00" className="max-w-xs" />
      ) : null}
      {permissions.canAttach ? (
        <PhotoPicker label="Fotos do resultado" hint="Opcional." files={photos} onChange={setPhotos} />
      ) : null}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending} className="self-start">
        {pending ? "Concluindo…" : "Concluir ocorrência"}
      </Button>
    </form>
  );
}

/** Acrescentar fotos durante o serviço (ou depois de abrir). */
export function AddPhotos({ establishmentId, workOrder }: { establishmentId: string; workOrder: { id: string; number: number } }) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [state, setState] = useState<FormState>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      <PhotoPicker label="Adicionar fotos" hint="" files={photos} onChange={setPhotos} />
      {photos.length > 0 ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await uploadWorkOrderPhotos(establishmentId, workOrder.id, photos, "progress");
              setPhotos([]);
              setState(result.errors.length ? { error: result.errors.join(" ") } : { success: `${result.uploaded} foto(s) enviada(s).` });
              await refreshWorkOrder(establishmentId, workOrder.number);
              router.refresh();
            })
          }
        >
          {pending ? "Enviando…" : `Enviar ${photos.length} foto(s)`}
        </Button>
      ) : null}
      <FormMessage state={state} />
    </div>
  );
}
