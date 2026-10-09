import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireEstablishment, requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InviteForm, MemberRow, RoleEditor, type RoleOption } from "./team-forms";

export const metadata: Metadata = { title: "Equipe" };

export default function TeamPage({ params }: PageProps<"/e/[establishmentId]/equipe">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Carregando equipe…</p>}>
      <Team params={params} />
    </Suspense>
  );
}

async function Team({ params }: Pick<PageProps<"/e/[establishmentId]/equipe">, "params">) {
  const { establishmentId } = await params;
  const { establishment, can } = await requireEstablishment(establishmentId);
  if (!can("members.manage")) notFound();
  const me = await requireUser();

  const supabase = await createSupabaseServerClient();
  const [{ data: roles }, { data: members }] = await Promise.all([
    supabase.from("roles").select("id, name, permissions, system_key").eq("establishment_id", establishmentId).order("created_at"),
    supabase
      .from("memberships")
      .select("id, status, role_id, user_id, profiles(full_name, email)")
      .eq("establishment_id", establishmentId)
      .order("created_at"),
  ]);

  const roleOptions: RoleOption[] = (roles ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    permissions: r.permissions,
    systemKey: r.system_key,
  }));
  // Só um Proprietário pode dar ou tirar o cargo de Proprietário (o banco também garante).
  const assignable = establishment.isOwner ? roleOptions : roleOptions.filter((r) => r.systemKey !== "owner");
  const ownerRoleId = roleOptions.find((r) => r.systemKey === "owner")?.id;

  return (
    <div className="flex flex-col gap-14">
      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(2rem,3.25vw,3.125rem)] leading-[1.1] font-[550] tracking-[-0.047em]">Equipe</h1>
        <p className="text-sm text-muted">Pessoas com acesso a {establishment.name} e o que cada cargo pode fazer.</p>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="membros">
        <h2 id="membros" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Membros
        </h2>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {(members ?? []).map((m) => (
            <MemberRow
              key={m.id}
              establishmentId={establishmentId}
              member={{
                id: m.id,
                name: m.profiles?.full_name || "Convite pendente",
                email: m.profiles?.email ?? "",
                roleId: m.role_id,
                status: m.status,
                isMe: m.user_id === me.id,
              }}
              roles={assignable}
              locked={!establishment.isOwner && m.role_id === ownerRoleId}
            />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="convidar">
        <h2 id="convidar" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Convidar pessoa
        </h2>
        <InviteForm establishmentId={establishmentId} roles={assignable} />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="cargos">
        <div className="flex flex-col gap-1">
          <h2 id="cargos" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Cargos
          </h2>
          <p className="text-sm text-muted">
            Proprietário tem acesso total e não pode ser alterado. Os outros cargos podem ser ajustados ou criados.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {roleOptions.map((role) => (
            <RoleEditor key={role.id} establishmentId={establishmentId} role={role} />
          ))}
          <RoleEditor establishmentId={establishmentId} />
        </div>
      </section>
    </div>
  );
}
