import { z } from "zod";

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "Nombre demasiado largo"),
  phone: z.string().trim().max(40).optional(),
  // "" = sin descuento
  discount_type: z
    .enum(["", "percentage", "fixed_per_product"])
    .optional(),
  // Llegan como texto desde el formulario; se limpian en la acción.
  discount_value: z.string().optional(),
  credit_limit: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const creditPaymentSchema = z.object({
  customer_id: z.string().uuid(),
  sale_id: z.string().uuid().nullable().optional(),
  amount: z.string().min(1, "Ingresa el monto"),
  payment_method: z.enum(["cash", "card", "transfer"]),
});
