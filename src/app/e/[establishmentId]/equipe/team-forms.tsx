"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { PERMISSION_GROUPS } from "@/lib/domain/permissions";
import { deleteRole, inviteMember, memberAction, saveRole } from "./actions";

export type RoleOption = { id: string; name: string; permissions: string[]; systemKey: string | null };

const selectClass =
  "h-10 rounded-[var(--radius-control)] border border-line bg-paper px-3 text-sm text-ink focus:border-ink";

export function InviteForm({ establishmentId, roles }: { establishmentId: string; roles: RoleOption[] }) {
  const [state, action] = useActionState(inviteMember.bind(null, establishmentId), null);
  const defaultRole = roles.find((r) => r.systemKey === "manager")?.id ?? roles[0]?.id;

  return (
    <form action={action} className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <Input label="Nome" name="full_name" autoComplete="off" required />
      <Input label="E-mail" name="email" type="email" autoComplete="off" required />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-role" className="text-xs font-semibold">
          Cargo
        </label>
        <select id="invite-role" name="role_id" defaultValue={defaultRole} className={selectClass} required>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <SubmitButton pendingLabel="Enviando convite…">Enviar convite</SubmitButton>
      </div>
      <FormMessage state={state} className="sm:col-span-2" />
    </form>
  );
}

type Member = { id: string; name: string; email: string; roleId: string; status: string; isMe: boolean };

export function MemberRow({
  establishmentId,
  member,
  roles,
  locked,
}: {
  establishmentId: string;
  member: Member;
  roles: RoleOption[];
  locked: boolean;
}) {
  const [state, action] = useActionState(memberAction.bind(null, establishmentId), null);
  const suspended = member.status === "suspended";
  const currentRole = roles.find((r) => r.id === member.roleId);

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col">
        <span className={cn("font-semibold", suspended && "text-muted line-through")}>
          {member.name}
          {member.isMe ? <span className="ml-2 text-xs font-normal text-muted">(você)</span> : null}
        </span>
        <span className="truncate text-xs text-muted">
          {member.email}
          {suspended ? " · acesso suspenso" : ""}
        </span>
      </div>

      {locked ? (
        <span className="text-sm text-muted">Proprietário</span>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="membership_id" value={member.id} />
          <label className="sr-only" htmlFor={`role-${member.id}`}>
            Cargo de {member.name}
          </label>
          <select id={`role-${member.id}`} name="role_id" defaultValue={currentRole?.id} className={cn(selectClass, "h-8 text-xs")}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <SubmitButton name="intent" value="change_role" variant="secondary" size="sm" pendingLabel="…">
            Mudar cargo
          </SubmitButton>
          {!member.isMe ? (
            <>
              <Button type="submit" name="intent" value={suspended ? "reactivate" : "suspend"} variant="ghost" size="sm">
                {suspended ? "Reativar" : "Suspender"}
              </Button>
              <Button
                type="submit"
                name="intent"
                value="remove"
                variant="ghost"
                size="sm"
                className="text-critical"
                onClick={(event) => {
                  if (!confirm(`Remover ${member.name} da equipe?`)) event.preventDefault();
                }}
              >
                Remover
              </Button>
            </>
          ) : null}
          <FormMessage state={state} className="w-full" />
        </form>
      )}
    </li>
  );
}

export function RoleEditor({ establishmentId, role }: { establishmentId: string; role?: RoleOption }) {
  const [state, action] = useActionState(saveRole.bind(null, establishmentId), null);
  const [deleteState, deleteAction] = useActionState(deleteRole.bind(null, establishmentId), null);
  const isOwner = role?.systemKey === "owner";
  const granted = new Set(role?.permissions ?? []);

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-line p-5">
      <form action={action} className="flex flex-col gap-4">
        {role ? <input type="hidden" name="id" value={role.id} /> : null}
        <Input
          label={role ? "Nome do cargo" : "Novo cargo"}
          name="name"
          defaultValue={role?.name}
          placeholder={role ? undefined : "Ex.: Técnico"}
          disabled={isOwner}
          required
        />
        <fieldset className="flex flex-col gap-4" disabled={isOwner}>
          <legend className="sr-only">Permissões</legend>
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.title} className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted">{group.title}</span>
              {group.items.map((item) => (
                <label key={item.key} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={item.key}
                    defaultChecked={isOwner || granted.has(item.key)}
                    className="mt-0.5 accent-[var(--ink)]"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          ))}
        </fieldset>
        {isOwner ? null : (
          <SubmitButton variant={role ? "secondary" : "primary"} pendingLabel="Guardando…">
            {role ? "Guardar cargo" : "Criar cargo"}
          </SubmitButton>
        )}
        <FormMessage state={state} />
      </form>

      {role && !role.systemKey ? (
        <form action={deleteAction} className="flex flex-col gap-2 border-t border-line pt-4">
          <input type="hidden" name="id" value={role.id} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="self-start text-critical"
            onClick={(event) => {
              if (!confirm(`Apagar o cargo ${role.name}?`)) event.preventDefault();
            }}
          >
            Apagar cargo
          </Button>
          <FormMessage state={deleteState} />
        </form>
      ) : null}
    </div>
  );
}
