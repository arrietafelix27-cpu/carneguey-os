"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { directPurchaseSchema } from "@/lib/validations/direct-purchase";

type Result = { ok: true } | { error: string };

export async function createDirectPurchase(values: unknown): Promise<Result> {
  const parsed = directPurchaseSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const d = parsed.data;
  const { error } = await supabase.rpc("fn_register_direct_purchase", {
    p_provider_id: d.provider_id,
    p_purchase_date: d.purchase_date,
    p_items: d.items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      total_cost: i.total_cost,
    })),
    p_notes: d.notes || null,
  });

  if (error) {
    return { error: `No se pudo registrar la compra: ${error.message}` };
  }

  revalidatePath("/empleado/compras");
  return { ok: true };
}
