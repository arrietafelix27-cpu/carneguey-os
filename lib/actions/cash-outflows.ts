"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth";
import { cashOutflowSchema } from "@/lib/validations/cash-outflow";

type Result = { ok: true } | { error: string };

function parseMoney(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits === "" ? 0 : Number(digits);
}

/**
 * Registra un egreso de efectivo. El status ('pending' o 'approved') lo fija
 * el trigger de la base según la categoría; no se manda desde el cliente.
 */
export async function createCashOutflow(values: unknown): Promise<Result> {
  const parsed = cashOutflowSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const amount = parseMoney(parsed.data.amount);
  if (amount <= 0) return { error: "El monto debe ser mayor a 0" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { error } = await supabase.from("cash_outflows").insert({
    amount,
    category: parsed.data.category,
    recipient: parsed.data.recipient || null,
    notes: parsed.data.notes || null,
    created_by: user.id,
  });
  if (error) {
    return { error: `No se pudo registrar el egreso: ${error.message}` };
  }

  revalidatePath("/empleado/egresos");
  revalidatePath("/empleado/cierre");
  revalidatePath("/admin/egresos");
  revalidatePath("/admin");
  return { ok: true };
}

/** El administrador aprueba o rechaza un egreso pendiente. */
export async function reviewCashOutflow(
  outflowId: string,
  approve: boolean,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_review_cash_outflow", {
    p_outflow_id: outflowId,
    p_approve: approve,
  });
  if (error) {
    return {
      error: `No se pudo ${approve ? "aprobar" : "rechazar"}: ${error.message}`,
    };
  }

  revalidatePath("/admin/egresos");
  revalidatePath("/admin");
  return { ok: true };
}
