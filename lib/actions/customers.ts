"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminContext } from "@/lib/auth";
import { customerSchema, creditPaymentSchema } from "@/lib/validations/customer";

type Result = { ok: true } | { error: string };

/** Convierte un monto de texto ("$54.000", "54000") a número (0 si vacío). */
function parseMoney(raw: string | undefined): number {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  return digits === "" ? 0 : Number(digits);
}

/** El descuento admite decimales (ej. 7,5 %). */
function parseDecimal(raw: string | undefined): number {
  const n = Number((raw ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fields(d: {
  name: string;
  phone?: string;
  discount_type?: "" | "percentage" | "fixed_per_product";
  discount_value?: string;
  credit_limit?: string;
  notes?: string;
}) {
  // "" (sin descuento) y undefined son falsy → null
  const type = d.discount_type ? d.discount_type : null;
  return {
    name: d.name,
    phone: d.phone ? d.phone : null,
    discount_type: type,
    discount_value: type
      ? type === "percentage"
        ? parseDecimal(d.discount_value)
        : parseMoney(d.discount_value)
      : 0,
    credit_limit: parseMoney(d.credit_limit),
    notes: d.notes ? d.notes : null,
  };
}

export async function createCustomer(values: unknown): Promise<Result> {
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.from("customers").insert(fields(parsed.data));
  if (error) return { error: `No se pudo crear el cliente: ${error.message}` };

  revalidatePath("/admin/clientes");
  return { ok: true };
}

export async function updateCustomer(
  id: string,
  values: unknown,
): Promise<Result> {
  const parsed = customerSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("customers")
    .update(fields(parsed.data))
    .eq("id", id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
  return { ok: true };
}

export async function setCustomerActive(
  id: string,
  active: boolean,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("customers")
    .update({ active })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el cliente" };

  revalidatePath("/admin/clientes");
  return { ok: true };
}

/** Registra un abono a la deuda de un cliente. */
export async function registerCreditPayment(values: unknown): Promise<Result> {
  const parsed = creditPaymentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const amount = parseMoney(parsed.data.amount);
  if (amount <= 0) return { error: "El monto debe ser mayor a 0" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { error } = await supabase.from("credit_payments").insert({
    customer_id: parsed.data.customer_id,
    sale_id: parsed.data.sale_id ?? null,
    amount,
    payment_method: parsed.data.payment_method,
    created_by: user.id,
  });
  if (error) return { error: `No se pudo registrar el abono: ${error.message}` };

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${parsed.data.customer_id}`);
  return { ok: true };
}
