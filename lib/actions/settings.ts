"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth";
import { coerceDecimal } from "@/lib/validations/decimal";
import { POLICY_KEYS, type PolicyKey } from "@/lib/permissions";

type Result = { ok: true } | { error: string };

const thresholdsSchema = z.object({
  beef: coerceDecimal(
    z.number().min(0, "Inválido").max(100, "Máximo 100"),
  ),
  pork: coerceDecimal(
    z.number().min(0, "Inválido").max(100, "Máximo 100"),
  ),
});

export async function updateMermaThresholds(
  values: unknown,
): Promise<Result> {
  const parsed = thresholdsSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Valores inválidos" };
  }

  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const now = new Date().toISOString();
  // La PK de app_settings es (organization_id, key) desde la migración 033.
  // organization_id lo pone el DEFAULT de la columna (current_org_id()).
  const { error } = await supabase.from("app_settings").upsert(
    [
      { key: "merma_threshold_beef", value: parsed.data.beef, updated_at: now },
      { key: "merma_threshold_pork", value: parsed.data.pork, updated_at: now },
    ],
    { onConflict: "organization_id,key" },
  );
  if (error) return { error: "No se pudo guardar los umbrales" };

  revalidatePath("/admin/analitica");
  revalidatePath("/admin/analitica/merma");
  revalidateTag("app_settings");
  return { ok: true };
}

/**
 * Guarda las políticas del negocio: qué puede hacer la cajera sola (038) y de
 * qué flujos se exige foto del comprobante (040). Solo admin.
 */
export async function updateDelicateActions(
  values: Partial<Record<PolicyKey, boolean>>,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const rows = POLICY_KEYS.filter((k) => typeof values[k] === "boolean").map(
    (key) => ({
      key,
      value: values[key] ? 1 : 0,
      updated_at: new Date().toISOString(),
    }),
  );
  if (rows.length === 0) return { error: "No hay nada que guardar" };

  const { error } = await supabase
    .from("app_settings")
    .upsert(rows, { onConflict: "organization_id,key" });
  if (error) return { error: "No se pudo guardar la configuración" };

  revalidatePath("/admin/configuracion/acciones");
  revalidatePath("/admin/transferencias");
  revalidatePath("/admin/sub-despostes");
  revalidatePath("/admin/egresos");
  revalidatePath("/admin");
  revalidatePath("/empleado/compras", "layout");
  revalidatePath("/empleado/gastos");
  return { ok: true };
}
