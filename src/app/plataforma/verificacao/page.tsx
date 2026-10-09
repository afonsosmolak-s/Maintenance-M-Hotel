"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Step =
  | { kind: "loading" }
  | { kind: "enroll"; factorId: string; qrCode: string; secret: string }
  | { kind: "verify"; factorId: string }
  | { kind: "error"; message: string };

/**
 * Verificação em duas etapas da plataforma (app autenticador, TOTP).
 * Na primeira vez mostra o QR code para cadastrar; depois só pede o código de 6 dígitos.
 */
export default function PlatformMfaPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setStep({ kind: "error", message: "Não foi possível verificar a sessão. Entre novamente." });

      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setStep({ kind: "verify", factorId: verified.id });

      // Cadastros iniciados e não concluídos são descartados antes de criar um novo.
      for (const factor of data.all.filter((f) => f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ZMOLAK Plataforma",
      });
      if (enrollError || !enrolled) return setStep({ kind: "error", message: "Não foi possível iniciar o cadastro." });
      setStep({ kind: "enroll", factorId: enrolled.id, qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.kind !== "enroll" && step.kind !== "verify") return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(code)) return setError("O código tem 6 dígitos.");

    setSubmitting(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: step.factorId, code });
    setSubmitting(false);
    if (verifyError) return setError("Código incorreto ou expirado. Tente o código atual do app.");

    router.replace("/plataforma");
    router.refresh();
  }

  if (step.kind === "loading") {
    return (
      <AuthShell title="Verificação em duas etapas">
        <p role="status" className="text-sm text-muted">
          Preparando…
        </p>
      </AuthShell>
    );
  }

  if (step.kind === "error") {
    return (
      <AuthShell title="Verificação em duas etapas" description={step.message}>
        <form action="/auth/sair" method="post">
          <Button type="submit" variant="secondary">
            Sair e entrar de novo
          </Button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verificação em duas etapas"
      description={
        step.kind === "enroll"
          ? "Obrigatória para a área da plataforma. Leia o QR code com um app autenticador (Google Authenticator, 1Password, Authy…) e digite o código gerado."
          : "Digite o código de 6 dígitos do seu app autenticador."
      }
    >
      {step.kind === "enroll" ? (
        <div className="flex flex-col items-start gap-3">
          {/* QR code em SVG gerado pelo Supabase (data URL). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={step.qrCode} alt="QR code para o app autenticador" width={180} height={180} className="bg-white p-2" />
          <p className="text-xs text-muted">
            Sem câmera? Digite a chave no app: <code className="break-all font-mono text-ink">{step.secret}</code>
          </p>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Código"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          error={error ?? undefined}
        />
        <Button type="submit" size="lg" disabled={submitting} aria-busy={submitting}>
          {submitting ? "Verificando…" : "Verificar"}
        </Button>
      </form>
    </AuthShell>
  );
}
