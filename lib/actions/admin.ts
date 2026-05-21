"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/auth";

type VoidResult = { ok: true } | { error: string };

export async function resetTestData(): Promise<VoidResult> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_reset_test_data");
  if (error) {
    return { error: `No se pudo resetear: ${error.message}` };
  }

  revalidatePath("/admin/inventario");
  revalidatePath("/admin/entradas");
  revalidatePath("/admin/conteo");
  return { ok: true };
}
