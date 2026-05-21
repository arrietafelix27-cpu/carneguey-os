"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth";

type StartResult = { ok: true; countId: string } | { error: string };
type VoidResult = { ok: true } | { error: string };

export async function startSalesCount(): Promise<StartResult> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { data, error } = await supabase.rpc("fn_start_sales_count", {
    p_notes: null,
  });
  if (error || !data) {
    return {
      error: error?.message
        ? `No se pudo iniciar el conteo: ${error.message}`
        : "No se pudo iniciar el conteo",
    };
  }
  revalidatePath("/admin/conteo");
  return { ok: true, countId: data as string };
}

const soldSchema = z
  .union([z.literal(""), z.coerce.number().min(0)])
  .transform((v) => (v === "" ? null : v));

export async function updateSalesItem(
  itemId: string,
  sold: string,
): Promise<VoidResult> {
  const parsed = soldSchema.safeParse(sold);
  if (!parsed.success) return { error: "Cantidad inválida" };

  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("physical_count_items")
    .update({ physical_quantity: parsed.data })
    .eq("id", itemId);
  if (error) return { error: "No se pudo guardar" };
  return { ok: true };
}

export async function completeSalesCount(
  countId: string,
): Promise<VoidResult> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_complete_sales_count", {
    p_count_id: countId,
  });
  if (error) {
    return { error: `No se pudo finalizar el conteo: ${error.message}` };
  }
  revalidatePath("/admin/conteo");
  revalidatePath("/admin/inventario");
  return { ok: true };
}
