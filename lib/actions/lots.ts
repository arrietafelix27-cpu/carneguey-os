"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth";
import {
  carcassLotSchema,
  liveLotSchema,
  lotArrivalSchema,
} from "@/lib/validations/lot";

type Result = { ok: true; lotCode: string } | { error: string };
type VoidResult = { ok: true } | { error: string };

/** El administrador finaliza un lote activo: el remanente se va a merma y se cierra. */
export async function closeLotWithMerma(lotId: string): Promise<VoidResult> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.rpc("fn_close_lot_with_merma", {
    p_lot_id: lotId,
  });
  if (error) {
    return { error: `No se pudo finalizar el lote: ${error.message}` };
  }

  revalidatePath("/admin/lotes/activos");
  revalidatePath("/admin/inventario");
  revalidatePath("/admin/analitica");
  revalidatePath(`/admin/lotes/${lotId}`);
  return { ok: true };
}

export async function createCarcassLot(formData: FormData): Promise<Result> {
  const raw = {
    type: formData.get("type"),
    provider_id: formData.get("provider_id"),
    carcass_count: formData.get("carcass_count"),
    carcass_weight_kg: formData.get("carcass_weight_kg"),
    carcass_purchase_cost: formData.get("carcass_purchase_cost"),
    arrival_date: formData.get("arrival_date"),
    notes: formData.get("notes") ?? "",
    payment_method: formData.get("payment_method") ?? "cash",
    due_date: formData.get("due_date") ?? "",
  };
  const parsed = carcassLotSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // La foto ya se subió desde el navegador; aquí llega solo la ruta.
  const photoPath = String(formData.get("photo_path") ?? "").trim();
  if (!photoPath) {
    return { error: "La foto del comprobante es obligatoria" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const d = parsed.data;

  const { data: lotRows, error: rpcError } = await supabase.rpc(
    "fn_create_lot_carcass",
    {
      p_type: d.type,
      p_provider_id: d.provider_id,
      p_carcass_count: d.carcass_count,
      p_carcass_weight_kg: d.carcass_weight_kg,
      p_carcass_purchase_cost: d.carcass_purchase_cost,
      p_carcass_transport_cost: 0,
      p_arrival_date: d.arrival_date,
      p_notes: d.notes || null,
      p_payment_method: d.payment_method,
      p_due_date: d.due_date || null,
    },
  );

  if (rpcError || !lotRows || lotRows.length === 0) {
    return {
      error: rpcError?.message
        ? `No se pudo registrar el lote: ${rpcError.message}`
        : "No se pudo registrar el lote",
    };
  }

  const { lot_id: lotId, lot_code: lotCode } = lotRows[0];

  // Indexa el comprobante (ya subido) en receipts.
  await supabase.from("receipts").insert({
    entity_type: "purchase_lot",
    entity_id: lotId,
    file_path: photoPath,
    uploaded_by: user.id,
  });

  revalidatePath("/empleado/compras");
  return { ok: true, lotCode };
}

export async function createLiveLot(values: unknown): Promise<Result> {
  const parsed = liveLotSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const d = parsed.data;

  const { data: lotRows, error } = await supabase.rpc("fn_create_lot_live", {
    p_provider_id: d.provider_id,
    p_live_animal_count: d.live_animal_count,
    p_live_weight_kg: d.live_weight_kg,
    p_live_purchase_cost: d.live_purchase_cost,
    p_transport_to_slaughter_cost: d.transport_to_slaughter_cost,
    p_slaughter_cost: d.slaughter_cost,
    p_transport_to_shop_cost: d.transport_to_shop_cost,
    p_other_costs: d.other_costs,
    p_live_purchase_date: d.live_purchase_date,
    p_notes: d.notes || null,
    p_payment_method: d.payment_method,
    p_due_date: d.due_date || null,
  });

  if (error || !lotRows || lotRows.length === 0) {
    return {
      error: error?.message
        ? `No se pudo registrar el lote: ${error.message}`
        : "No se pudo registrar el lote",
    };
  }

  revalidatePath("/admin/lotes");
  return { ok: true, lotCode: lotRows[0].lot_code };
}

export async function registerLotArrival(
  formData: FormData,
): Promise<VoidResult> {
  const parsed = lotArrivalSchema.safeParse({
    lot_id: formData.get("lot_id"),
    carcass_count: formData.get("carcass_count"),
    carcass_weight_kg: formData.get("carcass_weight_kg"),
    arrival_date: formData.get("arrival_date"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const d = parsed.data;
  const { error } = await supabase.rpc("fn_register_lot_arrival", {
    p_lot_id: d.lot_id,
    p_carcass_count: d.carcass_count,
    p_carcass_weight_kg: d.carcass_weight_kg,
    p_arrival_date: d.arrival_date,
    p_notes: d.notes || null,
  });
  if (error) {
    return { error: `No se pudo registrar la llegada: ${error.message}` };
  }

  // Foto del comprobante (opcional). Ya subida desde el navegador.
  const photoPath = String(formData.get("photo_path") ?? "").trim();
  if (photoPath) {
    await supabase.from("receipts").insert({
      entity_type: "purchase_lot",
      entity_id: d.lot_id,
      file_path: photoPath,
      uploaded_by: user.id,
    });
  }

  revalidatePath("/empleado/compras");
  return { ok: true };
}
