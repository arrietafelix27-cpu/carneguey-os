"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bogotaToday } from "@/lib/dates";

type Result = { ok: true; closingId: string } | { error: string };

function parseMoney(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits === "" ? 0 : Number(digits);
}

/** Cierra el día con el efectivo físico contado. Congela el cuadre. */
export async function closeDay(
  countedCash: string,
  notes?: string,
): Promise<Result> {
  const counted = parseMoney(countedCash);
  if (counted < 0) return { error: "El efectivo contado no es válido" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_close_day", {
    p_date: bogotaToday(),
    p_counted_cash: counted,
    p_notes: notes || null,
  });

  if (error || !data) {
    return {
      error: error?.message
        ? `No se pudo cerrar el día: ${error.message}`
        : "No se pudo cerrar el día",
    };
  }

  revalidatePath("/empleado/cierre");
  revalidatePath("/admin/cuadre");
  revalidatePath("/admin");
  return { ok: true, closingId: data as string };
}
