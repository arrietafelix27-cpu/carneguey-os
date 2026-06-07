"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  startDesposteSchema,
  desposteItemSchema,
} from "@/lib/validations/desposte";

type StartResult = { ok: true; desposteId: string } | { error: string };
type ItemResult =
  | { ok: true; itemId: string }
  | { error: string };
type VoidResult = { ok: true } | { error: string };

export async function startDesposte(values: unknown): Promise<StartResult> {
  const parsed = startDesposteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_start_desposte", {
    p_lot_id: parsed.data.lot_id,
    p_input_weight_kg: parsed.data.input_weight_kg,
  });

  if (error || !data) {
    return {
      error: error?.message
        ? `No se pudo iniciar el desposte: ${error.message}`
        : "No se pudo iniciar el desposte",
    };
  }

  revalidatePath("/empleado/desposte");
  return { ok: true, desposteId: data as string };
}

export async function addDesposteItem(values: unknown): Promise<ItemResult> {
  const parsed = desposteItemSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();

  // Verificar la unidad del producto: si es 'unit', exigir unit_count.
  const { data: prod } = await supabase
    .from("products")
    .select("unit")
    .eq("id", parsed.data.product_id)
    .single();
  if (!prod) return { error: "Producto no encontrado" };
  if (prod.unit === "unit") {
    if (parsed.data.unit_count == null || parsed.data.unit_count <= 0) {
      return { error: "La cantidad en unidades es obligatoria" };
    }
  }

  const { data, error } = await supabase
    .from("desposte_items")
    .insert({
      desposte_id: parsed.data.desposte_id,
      product_id: parsed.data.product_id,
      weight_kg: parsed.data.weight_kg,
      unit_count:
        prod.unit === "unit" ? (parsed.data.unit_count ?? null) : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      error: error?.message
        ? `No se pudo agregar el corte: ${error.message}`
        : "No se pudo agregar el corte",
    };
  }

  revalidatePath(`/empleado/desposte/${parsed.data.desposte_id}`);
  return { ok: true, itemId: data.id as string };
}

export async function removeDesposteItem(
  itemId: string,
): Promise<VoidResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("desposte_items")
    .delete()
    .eq("id", itemId);
  if (error) return { error: "No se pudo eliminar el corte" };
  return { ok: true };
}

export async function finalizeDesposte(
  desposteId: string,
): Promise<VoidResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_finalize_desposte", {
    p_desposte_id: desposteId,
  });
  if (error) {
    return { error: `No se pudo finalizar: ${error.message}` };
  }
  revalidatePath("/empleado/desposte");
  return { ok: true };
}

export async function cancelDesposte(
  desposteId: string,
): Promise<VoidResult> {
  const supabase = await createClient();
  // Borra los cortes registrados y el desposte (solo si está en curso; la
  // RLS lo garantiza). Sirve para cancelar un desposte iniciado por error.
  await supabase.from("desposte_items").delete().eq("desposte_id", desposteId);
  const { error } = await supabase
    .from("despostes")
    .delete()
    .eq("id", desposteId);
  if (error) return { error: "No se pudo cancelar el desposte" };
  revalidatePath("/empleado/desposte");
  return { ok: true };
}
