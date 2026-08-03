"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth";
import {
  supplierInvoiceSchema,
  supplierPaymentSchema,
} from "@/lib/validations/supplier";

type Result = { ok: true } | { error: string };

function parseMoney(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits === "" ? 0 : Number(digits);
}

/** Crea una factura de proveedor. Solo admin (la cajera nunca las crea). */
export async function createSupplierInvoice(values: unknown): Promise<Result> {
  const parsed = supplierInvoiceSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const amount = parseMoney(parsed.data.amount);
  if (amount <= 0) return { error: "El monto debe ser mayor a 0" };

  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.from("supplier_invoices").insert({
    provider_id: parsed.data.provider_id,
    amount,
    description: parsed.data.description,
    due_date: parsed.data.due_date ? parsed.data.due_date : null,
    is_private: parsed.data.is_private ?? false,
  });
  if (error) return { error: `No se pudo crear la factura: ${error.message}` };

  revalidatePath(`/admin/proveedores/${parsed.data.provider_id}`);
  revalidatePath("/admin/proveedores");
  revalidatePath("/empleado/proveedores");
  return { ok: true };
}

/**
 * Registra un pago de factura de proveedor vía fn_register_supplier_payment
 * (SECURITY DEFINER): valida monto, bloquea facturas privadas para la
 * cajera y actualiza el status atómicamente. Ni admin ni cajera insertan
 * directo a supplier_payments.
 */
export async function registerSupplierPayment(
  providerId: string,
  values: unknown,
): Promise<Result> {
  const parsed = supplierPaymentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const amount = parseMoney(parsed.data.amount);
  if (amount <= 0) return { error: "El monto debe ser mayor a 0" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_register_supplier_payment", {
    p_invoice_id: parsed.data.invoice_id,
    p_amount: amount,
    p_payment_source: parsed.data.source,
    p_notes: parsed.data.notes ? parsed.data.notes : null,
  });
  if (error) return { error: `No se pudo registrar el pago: ${error.message}` };

  revalidatePath(`/admin/proveedores/${providerId}`);
  revalidatePath("/admin/proveedores");
  revalidatePath(`/empleado/proveedores/${providerId}`);
  revalidatePath("/empleado/proveedores");
  return { ok: true };
}

/** El administrador marca/desmarca una factura como privada — la cajera deja de verla. */
export async function setSupplierInvoicePrivate(
  invoiceId: string,
  isPrivate: boolean,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { data, error } = await supabase
    .from("supplier_invoices")
    .update({ is_private: isPrivate })
    .eq("id", invoiceId)
    .select("provider_id")
    .single();
  if (error) return { error: `No se pudo actualizar la factura: ${error.message}` };

  revalidatePath(`/admin/proveedores/${data.provider_id}`);
  revalidatePath("/admin/proveedores");
  revalidatePath(`/empleado/proveedores/${data.provider_id}`);
  revalidatePath("/empleado/proveedores");
  return { ok: true };
}

/**
 * El administrador marca/desmarca TODO un proveedor como privado — oculta todas sus
 * deudas y pagos de la cajera de una sola vez (se suma a la privacidad por
 * factura, no la reemplaza).
 */
export async function setProviderPrivate(
  providerId: string,
  isPrivate: boolean,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("providers")
    .update({ is_private: isPrivate })
    .eq("id", providerId);
  if (error) return { error: `No se pudo actualizar el proveedor: ${error.message}` };

  revalidatePath(`/admin/proveedores/${providerId}`);
  revalidatePath("/admin/proveedores");
  revalidatePath(`/empleado/proveedores/${providerId}`);
  revalidatePath("/empleado/proveedores");
  return { ok: true };
}
