"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createEstablishment, setEstablishmentStatus } from "./actions";

export function NewEstablishmentForm() {
  const [state, action] = useActionState(createEstablishment, null);

  return (
    <form action={action} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Input label="Nome do estabelecimento" name="name" placeholder="Ex.: Motel Exemplo" required />
      <Input label="Razão social" name="legal_name" required />
      <Input label="CNPJ" name="cnpj" placeholder="00.000.000/0000-00" hint="Aceita CNPJ numérico e alfanumérico." required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kind" className="text-xs font-semibold">
          Tipo
        </label>
        <select
          id="kind"
          name="kind"
          defaultValue="motel"
          className="h-10 rounded-[var(--radius-control)] border border-line bg-paper px-3 text-sm focus:border-ink"
        >
          <option value="motel">Motel</option>
          <option value="hotel">Hotel</option>
          <option value="other">Outro</option>
        </select>
      </div>
      <Input label="Nome do Proprietário" name="owner_name" required />
      <Input label="E-mail do Proprietário" name="owner_email" type="email" hint="Recebe o convite por e-mail." required />
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel="Cadastrando…">Cadastrar e convidar</SubmitButton>
      </div>
      <FormMessage state={state} className="sm:col-span-2" />
    </form>
  );
}

export function StatusToggle({ id, name, status }: { id: string; name: string; status: string }) {
  const [state, action] = useActionState(setEstablishmentStatus, null);
  const active = status === "active";

  return (
    <form
      action={action}
      className="flex flex-col items-start gap-1"
      onSubmit={(event) => {
        const question = active
          ? `Suspender ${name}? Ninguém do estabelecimento consegue entrar até reativar. Nenhum dado é apagado.`
          : `Reativar ${name}?`;
        if (!confirm(question)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={active ? "suspended" : "active"} />
      <span className={active ? "text-success" : "text-critical"}>{active ? "Ativa" : "Suspensa"}</span>
      <SubmitButton variant="ghost" size="sm" className="-ml-3" pendingLabel="…">
        {active ? "Suspender" : "Reativar"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
