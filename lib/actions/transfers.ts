"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth";
import { cutTransferSchema } from "@/lib/validations/transfer";
import { getPermissions } from "@/lib/permissions.server";

type Result = { ok: true; applied?: boolean } | { error: string };

/**
 * Crea una transferencia de cortes. Si el negocio configuró "Transferir
 * cortes" como acción libre (migración 038), se aplica de una vez al
 * inventario; si no, queda pendiente de aprobación del dueño.
 */
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

  const { data: created, error } = await supabase
    .from("cut_transfers")
    .insert({
      source_product_id: parsed.data.source_product_id,
      dest_product_id: parsed.data.dest_product_id,
      quantity_kg: parsed.data.quantity_kg,
      notes: parsed.data.notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !created) {
    return {
      error: `No se pudo registrar la transferencia: ${error?.message ?? ""}`,
    };
  }

  // Acción libre: se aplica sola. La base vuelve a verificar el permiso y el
  // stock disponible, así que un fallo aquí deja la transferencia pendiente
  // en vez de aplicarla a medias.
  const permissions = await getPermissions(supabase);
  let applied = false;
  if (permissions.perm_cut_transfer) {
    const { error: applyError } = await supabase.rpc("fn_review_cut_transfer", {
      p_transfer_id: created.id,
      p_approve: true,
    });
    if (applyError) {
      revalidatePath("/empleado/transferencias");
      revalidatePath("/admin/transferencias");
      revalidatePath("/admin");
      return {
        error: `La transferencia quedó pendiente de aprobación: ${applyError.message}`,
      };
    }
    applied = true;
  }

  revalidatePath("/empleado/transferencias");
  revalidatePath("/admin/transferencias");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
  return { ok: true, applied };
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
