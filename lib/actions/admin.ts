"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminContext } from "@/lib/auth";

type VoidResult = { ok: true } | { error: string };

/** Borra todas las fotos del bucket 'receipts' vía Storage API (best-effort). */
async function clearReceiptsBucket(supabase: SupabaseClient) {
  async function removePrefix(prefix: string) {
    const { data } = await supabase.storage
      .from("receipts")
      .list(prefix, { limit: 1000 });
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        await removePrefix(path); // es una carpeta
      } else {
        await supabase.storage.from("receipts").remove([path]);
      }
    }
  }
  try {
    await removePrefix("");
  } catch {
    // El reset de la base ya se hizo; si una foto no se borra, no es crítico.
  }
}

export async function resetTestData(): Promise<VoidResult> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_reset_test_data");
  if (error) {
    return { error: `No se pudo resetear: ${error.message}` };
  }

  await clearReceiptsBucket(supabase);

  revalidatePath("/admin/inventario");
  revalidatePath("/admin/entradas");
  revalidatePath("/admin/conteo");
  return { ok: true };
}
