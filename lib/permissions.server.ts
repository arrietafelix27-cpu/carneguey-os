import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePermissions,
  STRICT_PERMISSIONS,
  type Permissions,
} from "@/lib/permissions";

/**
 * Permisos de acciones delicadas de la organización del usuario autenticado.
 * Sirve para el admin y para la cajera: `fn_get_permissions` entrega solo las
 * claves `perm_*`, nunca umbrales de merma ni ningún dato de plata.
 *
 * Si la consulta falla se devuelve lo estricto (todo pide aprobación).
 */
export async function getPermissions(
  client?: SupabaseClient,
): Promise<Permissions> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("fn_get_permissions");
  if (error) return STRICT_PERMISSIONS;
  return normalizePermissions(data);
}
