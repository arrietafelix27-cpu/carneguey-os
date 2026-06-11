import type { SupabaseClient } from "@supabase/supabase-js";

const ONE_HOUR = 3600;

/**
 * Devuelve URLs firmadas (válidas por 1 hora) para todas las fotos del
 * comprobante asociadas a una entidad. Lista vacía si no hay.
 */
export async function getReceiptSignedUrls(
  supabase: SupabaseClient,
  entityType: "purchase_lot" | "direct_purchase",
  entityId: string,
): Promise<string[]> {
  const { data: receipts } = await supabase
    .from("receipts")
    .select("file_path")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });

  const paths = (receipts ?? []).map((r) => r.file_path as string);
  if (paths.length === 0) return [];

  const urls = await Promise.all(
    paths.map(async (path) => {
      const { data } = await supabase.storage
        .from("receipts")
        .createSignedUrl(path, ONE_HOUR);
      return data?.signedUrl ?? null;
    }),
  );

  return urls.filter((u): u is string => u !== null);
}
