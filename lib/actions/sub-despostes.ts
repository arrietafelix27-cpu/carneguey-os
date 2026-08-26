"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth";
import { subDesposteSchema } from "@/lib/validations/sub-desposte";
import { getPermissions } from "@/lib/permissions.server";

type Result = { ok: true; applied?: boolean } | { error: string };

/**
 * Registra un sub-desposte con sus productos. Si el negocio configuró
 * "Hacer un sub-desposte" como acción libre (migración 038), se aplica de una
 * vez al inventario; si no, queda pendiente de aprobación del dueño.
 */
export async function createSubDesposte(values: unknown): Promise<Result> {
  const parsed = subDesposteSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  if (data.items.some((it) => it.product_id === data.source_product_id)) {
    return { error: "Un producto resultante no puede ser el mismo origen" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  // Validar unidades obligatorias para productos 'unit'.
  const ids = Array.from(new Set(data.items.map((it) => it.product_id)));
  const { data: prods } = await supabase
    .from("products")
    .select("id, unit")
    .in("id", ids);
  const unitById = new Map(
    (prods ?? []).map((p) => [p.id as string, p.unit as string]),
  );
  for (const it of data.items) {
    if (unitById.get(it.product_id) === "unit") {
      if (it.unit_count == null || it.unit_count <= 0) {
        return { error: "Hay un producto por unidades sin cantidad" };
      }
    }
  }

  // Insertar cabecera + items.
  const { data: head, error: headErr } = await supabase
    .from("sub_despostes")
    .insert({
      source_product_id: data.source_product_id,
      source_kg: data.source_kg,
      notes: data.notes || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (headErr || !head) {
    return {
      error: `No se pudo registrar el sub-desposte: ${headErr?.message ?? ""}`,
    };
  }

  const rows = data.items.map((it) => ({
    sub_desposte_id: head.id as string,
    product_id: it.product_id,
    weight_kg: it.weight_kg,
    unit_count:
      unitById.get(it.product_id) === "unit" ? (it.unit_count ?? null) : null,
  }));
  const { error: itemsErr } = await supabase
    .from("sub_desposte_items")
    .insert(rows);
  if (itemsErr) {
    // Limpieza best-effort de la cabecera huérfana.
    await supabase.from("sub_despostes").delete().eq("id", head.id);
    return {
      error: `No se pudieron guardar los productos: ${itemsErr.message}`,
    };
  }

  // Acción libre: se aplica sola. La base vuelve a verificar el permiso y el
  // stock disponible, así que un fallo aquí lo deja pendiente en vez de
  // aplicarlo a medias.
  const permissions = await getPermissions(supabase);
  let applied = false;
  if (permissions.perm_sub_desposte) {
    const { error: applyError } = await supabase.rpc("fn_review_sub_desposte", {
      p_sub_id: head.id,
      p_approve: true,
    });
    if (applyError) {
      revalidatePath("/empleado/sub-desposte");
      revalidatePath("/admin/sub-despostes");
      revalidatePath("/admin");
      return {
        error: `El sub-desposte quedó pendiente de aprobación: ${applyError.message}`,
      };
    }
    applied = true;
  }

  revalidatePath("/empleado/sub-desposte");
  revalidatePath("/admin/sub-despostes");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
  return { ok: true, applied };
}

/** El administrador aprueba o rechaza un sub-desposte. Solo al aprobar toca inventario. */
export async function reviewSubDesposte(
  subId: string,
  approve: boolean,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_review_sub_desposte", {
    p_sub_id: subId,
    p_approve: approve,
  });
  if (error) {
    return {
      error: `No se pudo ${approve ? "aprobar" : "rechazar"}: ${error.message}`,
    };
  }

  revalidatePath("/admin/sub-despostes");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin");
  revalidatePath("/empleado/sub-desposte");
  return { ok: true };
}
