import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente com a chave secreta: ignora a RLS. Usar só para o que o utilizador não pode
 * fazer com a própria sessão (convidar contas no Auth, procurar utilizador por e-mail),
 * sempre depois de verificar a permissão de quem pede.
 */
export function createSupabaseAdminClient() {
  const secretKey = z
    .string({ error: "SUPABASE_SECRET_KEY não configurada." })
    .startsWith("sb_secret_")
    .parse(process.env.SUPABASE_SECRET_KEY);

  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
