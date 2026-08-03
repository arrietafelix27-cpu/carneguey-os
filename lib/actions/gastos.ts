"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EXPENSE_SUBCATEGORIES } from "@/lib/validations/cash-outflow";

type Result = { ok: true } | { error: string };

function parseMoney(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits === "" ? 0 : Number(digits);
}

/**
 * Registra un gasto/salida desde el celular. Las tres categorías exigen foto:
 *  - sf: salida de efectivo (queda pendiente)
 *  - employee_advance: préstamo a empleado (crea cash_outflow + employee_loan
 *    vía fn_create_employee_loan; queda pendiente)
 *  - expense: gasto operativo con subcategoría (queda aprobado)
 * La foto va al bucket 'receipts' con entity_type='cash_outflow'.
 */
export async function createGasto(formData: FormData): Promise<Result> {
  const category = String(formData.get("category") ?? "");
  const amount = parseMoney(String(formData.get("amount") ?? ""));
  if (amount <= 0) return { error: "El monto debe ser mayor a 0" };

  // La foto ya se subió desde el navegador; aquí llega solo la ruta.
  const photoPath = String(formData.get("photo_path") ?? "").trim();
  if (!photoPath) return { error: "La foto del soporte es obligatoria" };

  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  let outflowId: string;

  if (category === "sf") {
    const { data, error } = await supabase
      .from("cash_outflows")
      .insert({ created_by: user.id, amount, category: "sf", notes })
      .select("id")
      .single();
    if (error || !data) {
      return { error: `No se pudo registrar: ${error?.message ?? ""}` };
    }
    outflowId = data.id as string;
  } else if (category === "expense") {
    const subcategory = String(formData.get("subcategory") ?? "");
    if (
      !(EXPENSE_SUBCATEGORIES as readonly string[]).includes(subcategory)
    ) {
      return { error: "Elige la subcategoría del gasto" };
    }
    const description = String(formData.get("description") ?? "").trim();
    if (!description) return { error: "Escribe una descripción corta" };

    const { data, error } = await supabase
      .from("cash_outflows")
      .insert({
        created_by: user.id,
        amount,
        category: "expense",
        subcategory,
        notes: description,
      })
      .select("id")
      .single();
    if (error || !data) {
      return { error: `No se pudo registrar: ${error?.message ?? ""}` };
    }
    outflowId = data.id as string;
  } else if (category === "employee_advance") {
    const employeeId = String(formData.get("employee_id") ?? "");
    if (!employeeId) return { error: "Elige el empleado" };

    const { data, error } = await supabase.rpc("fn_create_employee_loan", {
      p_employee_id: employeeId,
      p_amount: amount,
      p_notes: notes,
    });
    if (error || !data) {
      return {
        error: `No se pudo registrar el préstamo: ${error?.message ?? ""}`,
      };
    }
    outflowId = data as string;
  } else {
    return { error: "Categoría inválida" };
  }

  // Indexa la foto (ya subida) en receipts.
  const { error: receiptError } = await supabase.from("receipts").insert({
    entity_type: "cash_outflow",
    entity_id: outflowId,
    file_path: photoPath,
    uploaded_by: user.id,
  });
  if (receiptError) {
    return {
      error: `El registro se guardó pero la foto no quedó indexada: ${receiptError.message}`,
    };
  }

  revalidatePath("/empleado/gastos");
  revalidatePath("/empleado/cierre");
  revalidatePath("/admin/egresos");
  revalidatePath("/admin");
  return { ok: true };
}
