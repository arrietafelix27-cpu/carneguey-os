"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/auth";

type Result = { ok: true } | { error: string };
type StartResult = { ok: true; countId: string } | { error: string };

/**
 * Arranca un conteo quincenal. Si ya hay uno en progreso, devuelve ese mismo
 * id en vez de crear otro: solo puede haber UN conteo en progreso a la vez.
 */
export async function startQuincenalCount(): Promise<StartResult> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { data: existing } = await supabase
    .from("physical_counts")
    .select("id")
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: true, countId: existing[0].id as string };
  }

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
  revalidatePath("/admin/conteos");
  revalidatePath("/admin/conteo/nuevo");
  return { ok: true, countId: data as string };
}

/** Guardar valores de "vendido" en bulk (sesión 1). */
export async function saveSalesQuincenal(
  countId: string,
  items: Array<{ item_id: string; sold: string }>,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_save_count_sales", {
    p_count_id: countId,
    p_items: items,
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/admin/conteo/nuevo");
  return { ok: true };
}

/** Guardar valores de "¿cuánto hay en realidad?" en bulk (sesión 2). */
export async function saveActualsQuincenal(
  countId: string,
  items: Array<{ item_id: string; actual: string }>,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_save_count_actuals", {
    p_count_id: countId,
    p_items: items,
  });
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/admin/conteo/nuevo");
  return { ok: true };
}

/** Finaliza el conteo: ajusta el inventario a actual_quantity por producto. */
export async function finalizeQuincenalCount(
  countId: string,
  notes?: string,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_finalize_quincenal_count", {
    p_count_id: countId,
    p_notes: notes ?? null,
  });
  if (error) return { error: `No se pudo finalizar: ${error.message}` };
  revalidatePath("/admin/conteo/nuevo");
  revalidatePath("/admin/conteos");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
  return { ok: true };
}

/** Cancela el conteo: marca cancelled y NO toca el inventario. */
export async function cancelQuincenalCount(
  countId: string,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_cancel_quincenal_count", {
    p_count_id: countId,
  });
  if (error) return { error: `No se pudo cancelar: ${error.message}` };
  revalidatePath("/admin/conteo/nuevo");
  revalidatePath("/admin/conteos");
  return { ok: true };
}
