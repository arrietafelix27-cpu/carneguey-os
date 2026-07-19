import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InvoiceRow,
  PaymentRow,
} from "@/components/shared/supplier-account-view";

/**
 * Facturas + pagos de un proveedor, ya unidos y con saldo calculado.
 * RLS ya filtra qué filas llegan según el rol (admin ve privadas, la
 * cajera no) — esta función no distingue rol, solo arma lo que Supabase
 * devolvió.
 */
export async function getSupplierAccount(
  supabase: SupabaseClient,
  providerId: string,
): Promise<{
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  pendingTotal: number;
}> {
  const { data: invoicesData } = await supabase
    .from("supplier_invoices")
    .select(
      "id, created_at, amount, due_date, description, status, is_private",
    )
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });

  const invoiceIds = (invoicesData ?? []).map((i) => i.id as string);

  const { data: paymentsData } =
    invoiceIds.length > 0
      ? await supabase
          .from("supplier_payments")
          .select(
            "id, created_at, supplier_invoice_id, amount, payment_source, notes",
          )
          .in("supplier_invoice_id", invoiceIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const paidByInvoice = new Map<string, number>();
  for (const p of paymentsData ?? []) {
    const key = p.supplier_invoice_id as string;
    paidByInvoice.set(key, (paidByInvoice.get(key) ?? 0) + Number(p.amount));
  }

  const descByInvoice = new Map(
    (invoicesData ?? []).map((i) => [
      i.id as string,
      i.description as string,
    ]),
  );

  const invoices: InvoiceRow[] = (invoicesData ?? []).map((i) => {
    const amount = Number(i.amount);
    const paid = paidByInvoice.get(i.id as string) ?? 0;
    return {
      id: i.id as string,
      createdAt: i.created_at as string,
      amount,
      paid,
      remaining: Math.max(amount - paid, 0),
      dueDate: (i.due_date as string | null) ?? null,
      description: i.description as string,
      status: i.status as InvoiceRow["status"],
      isPrivate: i.is_private as boolean,
    };
  });

  const payments: PaymentRow[] = (paymentsData ?? []).map((p) => ({
    id: p.id as string,
    createdAt: p.created_at as string,
    invoiceDescription:
      descByInvoice.get(p.supplier_invoice_id as string) ?? "Factura",
    amount: Number(p.amount),
    source: p.payment_source as PaymentRow["source"],
    notes: (p.notes as string | null) ?? null,
  }));

  const pendingTotal = invoices
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + i.remaining, 0);

  return { invoices, payments, pendingTotal };
}
