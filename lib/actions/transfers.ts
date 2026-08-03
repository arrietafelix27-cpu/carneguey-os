"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth";
import { cutTransferSchema } from "@/lib/validations/transfer";

type Result = { ok: true } | { error: string };

/** Cajera o admin crea una transferencia de cortes en estado pendiente. */
export async function createCutTransfer(values: unknown): Promise<Result> {
  const parsed = cutTransferSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { error } = await supabase.from("cut_transfers").insert({
    source_product_id: parsed.data.source_product_id,
    dest_product_id: parsed.data.dest_product_id,
    quantity_kg: parsed.data.quantity_kg,
    notes: parsed.data.notes || null,
    created_by: user.id,
  });
  if (error) {
    return { error: `No se pudo registrar la transferencia: ${error.message}` };
  }

  revalidatePath("/empleado/transferencias");
  revalidatePath("/admin/transferencias");
  revalidatePath("/admin");
  return { ok: true };
}

/** El administrador aprueba o rechaza una transferencia. Solo al aprobar toca inventario. */
export async function reviewCutTransfer(
  transferId: string,
  approve: boolean,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_review_cut_transfer", {
    p_transfer_id: transferId,
    p_approve: approve,
  });
  if (error) {
    return {
      error: `No se pudo ${approve ? "aprobar" : "rechazar"}: ${error.message}`,
    };
  }

  revalidatePath("/admin/transferencias");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
  revalidatePath("/empleado/transferencias");
  return { ok: true };
}
