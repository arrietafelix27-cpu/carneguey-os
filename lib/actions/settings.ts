"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth";

type Result = { ok: true } | { error: string };

const thresholdsSchema = z.object({
  beef: z.coerce.number().min(0, "Inválido").max(100, "Máximo 100"),
  pork: z.coerce.number().min(0, "Inválido").max(100, "Máximo 100"),
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
  const { error } = await supabase.from("app_settings").upsert(
    [
      { key: "merma_threshold_beef", value: parsed.data.beef, updated_at: now },
      { key: "merma_threshold_pork", value: parsed.data.pork, updated_at: now },
    ],
    { onConflict: "key" },
  );
  if (error) return { error: "No se pudo guardar los umbrales" };

  revalidatePath("/admin/analitica");
  revalidatePath("/admin/analitica/merma");
  revalidateTag("app_settings");
  return { ok: true };
}
