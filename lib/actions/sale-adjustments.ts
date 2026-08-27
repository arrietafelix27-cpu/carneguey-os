"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth";
import { getPermissions } from "@/lib/permissions.server";

/**
 * Anular y devolver ventas (migración 039).
 *
 * ANULAR   — la venta no debió existir. Solo el mismo día, con el cuadre sin
 *            cerrar. Todo vuelve al inventario y la venta sale del cuadre.
 * DEVOLVER — el cliente trajo el producto de vuelta hoy. Sin límite de tiempo,
 *            puede ser parcial, y la cajera elige si vuelve al inventario o se
 *            da por perdido.
 *
 * Ambas son acciones delicadas: si el negocio no las tiene sueltas, quedan
 * pendientes de aprobación del dueño. Quien decide es la base de datos, no
 * esta capa.
 */

type RequestResult =
  | { ok: true; applied: boolean; kind: "void" | "return" }
  | { error: string };
type ReviewResult = { ok: true } | { error: string };

const returnItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive("La cantidad debe ser mayor a cero"),
});

const requestSchema = z
  .object({
    sale_id: z.string().uuid(),
    kind: z.enum(["void", "return"]),
    reason: z.string().trim().max(500).optional(),
    refund_method: z.enum(["cash", "credit_note"]).nullable().optional(),
    restock: z.boolean().optional(),
    items: z.array(returnItemSchema).optional(),
  })
  .refine(
    (v) => v.kind !== "return" || (v.items?.length ?? 0) > 0,
    { message: "Elige al menos un producto para devolver", path: ["items"] },
  )
  .refine(
    (v) => v.kind !== "return" || !!v.refund_method,
    {
      message: "Elige cómo se le devuelve la plata al cliente",
      path: ["refund_method"],
    },
  );

function revalidateAll() {
  revalidatePath("/admin/ventas");
  revalidatePath("/admin/devoluciones");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin/cuadre");
  revalidatePath("/admin");
  revalidatePath("/empleado/ventas-dia");
  revalidatePath("/empleado/cierre");
}

/** Detalle de una venta para armar la corrección (definer: la cajera no lee `sales`). */
export async function getSaleForAdjustment(saleId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_sale_for_adjustment", {
    p_sale_id: saleId,
  });
  if (error || !data) return null;
  return data as {
    id: string;
    created_at: string;
    payment_method: "cash" | "card" | "transfer" | "credit";
    customer_id: string | null;
    total: number;
    status: string;
    same_day: boolean;
    items: {
      product_id: string;
      name: string;
      unit: "kg" | "unit";
      quantity: number;
      unit_price: number;
      total_price: number;
      returned_qty: number;
    }[];
  };
}

/** Pide anular o devolver. Si la acción está suelta, se aplica de una vez. */
export async function requestSaleAdjustment(
  values: unknown,
): Promise<RequestResult> {
  const parsed = requestSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_request_sale_adjustment", {
    p_sale_id: d.sale_id,
    p_kind: d.kind,
    p_reason: d.reason ?? null,
    p_refund_method: d.kind === "return" ? (d.refund_method ?? null) : null,
    p_restock: d.kind === "return" ? (d.restock ?? true) : true,
    p_items:
      d.kind === "return"
        ? d.items?.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          }))
        : null,
  });

  if (error) {
    return {
      error:
        error.message ||
        (d.kind === "void"
          ? "No se pudo anular la venta"
          : "No se pudo registrar la devolución"),
    };
  }

  // La base ya decidió si se aplicó o quedó pendiente; esto es solo para
  // decirle a la cajera qué pasó.
  const permissions = await getPermissions(supabase);
  const applied =
    d.kind === "void"
      ? permissions.perm_void_sale
      : permissions.perm_return_sale;

  revalidateAll();
  return { ok: true, applied, kind: d.kind };
}

/** El dueño aprueba o rechaza una solicitud pendiente. */
export async function reviewSaleAdjustment(
  adjustmentId: string,
  approve: boolean,
): Promise<ReviewResult> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_review_sale_adjustment", {
    p_id: adjustmentId,
    p_approve: approve,
  });
  if (error) {
    return {
      error:
        error.message ||
        `No se pudo ${approve ? "aprobar" : "rechazar"} la solicitud`,
    };
  }

  revalidateAll();
  return { ok: true };
}
