import { z } from "zod";

export const supplierInvoiceSchema = z.object({
  provider_id: z.string().uuid(),
  amount: z.string().min(1, "Ingresa el monto"),
  description: z
    .string()
    .trim()
    .min(1, "Escribe una descripción corta")
    .max(200, "Descripción demasiado larga"),
  due_date: z.string().trim().optional(),
  is_private: z.boolean().optional(),
});

export type SupplierInvoiceInput = z.infer<typeof supplierInvoiceSchema>;

export const supplierPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.string().min(1, "Ingresa el monto"),
  payment_method: z.enum(["cash", "card", "transfer"]),
  notes: z.string().trim().max(200).optional(),
});

export type SupplierPaymentInput = z.infer<typeof supplierPaymentSchema>;
