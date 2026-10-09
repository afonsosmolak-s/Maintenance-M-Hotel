"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/ui/form-message";
import { fullNameSchema, newPasswordSchema } from "@/lib/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Conclui o convite: o convidado define nome e senha. */
export async function completeInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = fullNameSchema.safeParse(formData.get("full_name"));
  if (!name.success) return { error: name.error.issues[0]?.message };
  const password = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!password.success) return { error: password.error.issues[0]?.message };

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { error: "O link do convite expirou. Peça um novo convite." };

  const { error } = await supabase.auth.updateUser({
    password: password.data.password,
    data: { full_name: name.data },
  });
  if (error) return { error: "Não foi possível guardar a senha. Tente outra." };

  await supabase.from("profiles").update({ full_name: name.data }).eq("id", userId);
  redirect("/inicio");
}

/** Nova senha depois do link de recuperação. */
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = newPasswordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!password.success) return { error: password.error.issues[0]?.message };

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "O link expirou. Peça uma nova recuperação de senha." };

  const { error } = await supabase.auth.updateUser({ password: password.data.password });
  if (error) return { error: "Não foi possível guardar a senha. Tente outra." };

  redirect("/inicio");
}
