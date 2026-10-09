import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** Cliente para Client Components. Sujeito à RLS com a sessão do utilizador. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
