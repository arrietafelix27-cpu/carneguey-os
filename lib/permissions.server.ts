import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizePolicies,
  STRICT_POLICIES,
  type Policies,
} from "@/lib/permissions";

/**
 * Políticas del negocio (acciones delicadas + comprobantes con foto) de la
 * organización del usuario autenticado. Sirve para el admin y para la cajera:
 * `fn_get_permissions` entrega solo las claves de política, nunca umbrales de
 * merma ni ningún dato de plata.
 *
 * Si la consulta falla se devuelve lo estricto: todo pide aprobación y todo
 * exige foto.
 */
export async function getPolicies(
  client?: SupabaseClient,
): Promise<Policies> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("fn_get_permissions");
  if (error) return STRICT_POLICIES;
  return normalizePolicies(data);
}

/** Compatibilidad con el nombre anterior. */
export const getPermissions = getPolicies;
