"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/auth";

type Deduction = {
  employee_loan_id: string | null;
  description: string;
  amount: number;
};

type Input = {
  payment_date: string;
  period: "first" | "second";
  employee_id: string;
  gross: number;
  net: number;
  notes?: string | null;
  receipt_url: string;
  deductions: Deduction[];
};

type Result = { ok: true } | { error: string };

/** Registra un pago de nómina (pago + deducciones) vía fn_register_payroll_payment. */
export async function registerPayrollPayment(input: Input): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  if (!input.receipt_url) {
    return { error: "La foto de la hoja firmada es obligatoria" };
  }
  if (input.period !== "first" && input.period !== "second") {
    return { error: "Selecciona el período" };
  }
  if (input.net < 0) return { error: "El monto pagado no es válido" };

  const { error } = await supabase.rpc("fn_register_payroll_payment", {
    p_payment_date: input.payment_date,
    p_period: input.period,
    p_employee_id: input.employee_id,
    p_gross: input.gross,
    p_net: input.net,
    p_notes: input.notes ?? null,
    p_receipt_url: input.receipt_url,
    p_deductions: input.deductions,
  });
  if (error) {
    return { error: `No se pudo registrar el pago: ${error.message}` };
  }

  revalidatePath("/admin/nomina/pago");
  revalidatePath(`/admin/empleados/${input.employee_id}`);
  return { ok: true };
}
