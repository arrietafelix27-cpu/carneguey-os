"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminContext } from "@/lib/auth";
import { detectPattern, parseBarcode, type ScalePattern } from "@/lib/barcode";

type Result = { ok: true } | { error: string };

/** Lee el patrón de báscula de la organización del usuario (o null si falta). */
export async function readOrgScalePattern(
  supabase: SupabaseClient,
): Promise<ScalePattern | null> {
  const { data } = await supabase
    .from("organizations")
    .select(
      "barcode_code_start, barcode_code_len, barcode_weight_start, barcode_weight_len, barcode_weight_divisor",
    )
    .single();
  if (!data || data.barcode_code_start == null) return null;
  return {
    codeStart: data.barcode_code_start as number,
    codeLen: data.barcode_code_len as number,
    weightStart: data.barcode_weight_start as number,
    weightLen: data.barcode_weight_len as number,
    weightDivisor: data.barcode_weight_divisor as number,
  };
}

/**
 * Configura el código de báscula de un producto. Solo admin.
 *  - Primera vez del negocio (sin patrón): exige el peso confirmado y deduce
 *    el patrón de la báscula (código + peso), y lo guarda para la organización.
 *  - Con patrón ya existente: verifica que el código escaneado coincide con el
 *    código que escribió el dueño (rechaza escaneos que no cuadran).
 * En ambos casos deja el pos_code del producto igual al código escrito.
 */
export async function configureProductScale(input: {
  productId: string;
  posCode: string;
  barcode: string;
  weightKg?: number | null;
}): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const posCode = String(input.posCode ?? "").trim();
  if (!posCode) return { error: "Escribe el código del producto" };
  const barcode = String(input.barcode ?? "").trim();
  if (!barcode) return { error: "Escanea el ticket de la báscula" };

  const pattern = await readOrgScalePattern(supabase);

  if (!pattern) {
    // Primera vez: hay que deducir el patrón con el peso confirmado.
    const weightKg =
      typeof input.weightKg === "number" ? input.weightKg : NaN;
    if (!(weightKg > 0)) {
      return {
        error:
          "Es la primera vez con esta báscula: confirma el peso que muestra la báscula.",
      };
    }
    const det = detectPattern(barcode, posCode, weightKg);
    if (!det.ok) return { error: det.reason };

    const { error: e1 } = await supabase.rpc("fn_set_scale_pattern", {
      p_code_start: det.pattern.codeStart,
      p_code_len: det.pattern.codeLen,
      p_weight_start: det.pattern.weightStart,
      p_weight_len: det.pattern.weightLen,
      p_weight_divisor: det.pattern.weightDivisor,
    });
    if (e1) return { error: `No se pudo guardar el patrón: ${e1.message}` };
  } else {
    // Ya hay patrón: el escaneo debe cuadrar con el código escrito.
    const parsed = parseBarcode(barcode, pattern);
    if (!parsed) {
      return {
        error: "El código escaneado no tiene el formato de tu báscula.",
      };
    }
    if (parsed.posCode !== posCode) {
      return {
        error: `El código escaneado (${parsed.posCode}) no coincide con el que escribiste (${posCode}).`,
      };
    }
  }

  const { error: e2 } = await supabase
    .from("products")
    .update({ pos_code: posCode })
    .eq("id", input.productId);
  if (e2) {
    return { error: `No se pudo guardar el código del producto: ${e2.message}` };
  }

  revalidatePath("/admin/productos");
  return { ok: true };
}
