"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/ui/form-message";
import { getRequestOrigin } from "@/lib/auth/origin";
import { safeNextPath } from "@/lib/auth/redirects";
import { emailSchema } from "@/lib/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, { error: "Informe a senha." }) });

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Mensagem única: não revela se o e-mail existe.
  if (error) return { error: "E-mail ou senha incorretos." };

  redirect(safeNextPath(formData.get("next")));
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createSupabaseServerClient();
  const origin = await getRequestOrigin();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/auth/nova-senha`,
  });

  // Mesma resposta exista ou não a conta.
  return { success: "Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha." };
}
