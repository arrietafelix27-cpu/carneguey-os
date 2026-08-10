import { createClient } from "@/lib/supabase/server";
import type { Product, Provider } from "@/lib/catalog";
import type { MermaThresholds } from "@/lib/analytics";

/**
 * Catálogo (proveedores, productos, umbrales). Se quitó el caché global
 * service-role (D-017): cacheaba sin distinguir negocio y sería una fuga de
 * catálogo entre organizaciones. Ahora se consulta directo con la sesión del
 * usuario — la RLS filtra por organización. El volumen por carnicería es
 * pequeño, así que el costo es despreciable.
 *
 * Los nombres y firmas se conservan para no tocar a quienes las llaman.
 */

export async function getActiveProviders(): Promise<Provider[]> {
  const db = await createClient();
  const { data } = await db
    .from("providers")
    .select("id, name, phone, active")
    .eq("active", true)
    .order("name");
  return (data ?? []) as Provider[];
}

export async function getAllProviders(): Promise<Provider[]> {
  const db = await createClient();
  const { data } = await db
    .from("providers")
    .select("id, name, phone, active")
    .order("name");
  return (data ?? []) as Provider[];
}

export async function getActiveProducts(): Promise<Product[]> {
  const db = await createClient();
  const { data } = await db
    .from("products")
    .select(
      "id, name, category, unit, origin, pos_code, active, shared_across_species",
    )
    .eq("active", true)
    .order("name");
  return (data ?? []) as Product[];
}

export async function getMermaThresholdsCached(): Promise<MermaThresholds> {
  const db = await createClient();
  const { data } = await db.from("app_settings").select("key, value");
  const map = new Map(
    (data ?? []).map((r) => [r.key as string, Number(r.value)]),
  );
  return {
    beef: map.get("merma_threshold_beef") ?? 8,
    pork: map.get("merma_threshold_pork") ?? 5,
  };
}
