"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const itemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  total_price: z.number().min(0),
});

const saleSchema = z.object({
  payment_method: z.enum(["cash", "card", "transfer"]),
  subtotal: z.number().min(0),
  total: z.number().min(0),
  amount_paid: z.number().min(0).nullable().optional(),
  change_given: z.number().nullable().optional(),
  items: z.array(itemSchema).min(1, "La venta no tiene productos"),
});

type Result = { ok: true; saleId: string } | { error: string };

/** Guarda una venta del POS y descuenta inventario (vía fn_complete_sale). */
export async function completeSale(values: unknown): Promise<Result> {
  const parsed = saleSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos de venta inválidos" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_complete_sale", {
    p_payment_method: d.payment_method,
    p_subtotal: d.subtotal,
    p_total: d.total,
    p_amount_paid: d.amount_paid ?? null,
    p_change_given: d.change_given ?? null,
    p_items: d.items,
  });

  if (error || !data) {
    return {
      error: error?.message
        ? `No se pudo cobrar: ${error.message}`
        : "No se pudo cobrar la venta",
    };
  }

  return { ok: true, saleId: data as string };
}
