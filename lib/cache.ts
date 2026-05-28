import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Product, Provider } from "@/lib/catalog";
import type { MermaThresholds } from "@/lib/analytics";

/**
 * Datos públicos del catálogo que cambian poco. Se cachean a nivel global
 * (todos los usuarios ven los mismos productos/proveedores activos) y se
 * invalidan vía `revalidateTag` cuando se editan desde admin.
 *
 * Usa un cliente service-role (sin sesión) porque `unstable_cache` no puede
 * estar atado a cookies de un request específico.
 */
function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export const getActiveProviders = unstable_cache(
  async (): Promise<Provider[]> => {
    const db = serviceClient();
    const { data } = await db
      .from("providers")
      .select("id, name, phone, active")
      .eq("active", true)
      .order("name");
    return (data ?? []) as Provider[];
  },
  ["providers-active"],
  { tags: ["providers"], revalidate: 3600 },
);

export const getAllProviders = unstable_cache(
  async (): Promise<Provider[]> => {
    const db = serviceClient();
    const { data } = await db
      .from("providers")
      .select("id, name, phone, active")
      .order("name");
    return (data ?? []) as Provider[];
  },
  ["providers-all"],
  { tags: ["providers"], revalidate: 3600 },
);

export const getActiveProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const db = serviceClient();
    const { data } = await db
      .from("products")
      .select("id, name, category, unit, origin, pos_code, active")
      .eq("active", true)
      .order("name");
    return (data ?? []) as Product[];
  },
  ["products-active"],
  { tags: ["products"], revalidate: 3600 },
);

export const getMermaThresholdsCached = unstable_cache(
  async (): Promise<MermaThresholds> => {
    const db = serviceClient();
    const { data } = await db.from("app_settings").select("key, value");
    const map = new Map(
      (data ?? []).map((r) => [r.key as string, Number(r.value)]),
    );
    return {
      beef: map.get("merma_threshold_beef") ?? 8,
      pork: map.get("merma_threshold_pork") ?? 5,
    };
  },
  ["merma-thresholds"],
  { tags: ["app_settings"], revalidate: 86400 },
);
