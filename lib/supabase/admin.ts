import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente admin con la service_role key. SOLO servidor: el import
 * "server-only" hace fallar el build si algo del navegador lo importa.
 * Usar únicamente en Server Actions para administrar usuarios (Auth).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
