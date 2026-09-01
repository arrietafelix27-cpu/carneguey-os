import { z } from "zod";
import { coerceDecimal } from "@/lib/validations/decimal";
import { bogotaToday } from "@/lib/dates";


export const directPurchaseItemSchema = z.object({
  product_id: z.string().uuid("Selecciona un producto"),
  quantity: coerceDecimal(
    z
      .number({ message: "Cantidad inválida" })
      .positive("La cantidad debe ser mayor a 0"),
  ),
  total_cost: coerceDecimal(
    z
      .number({ message: "Costo inválido" })
      .positive("El costo debe ser mayor a 0"),
  ),
});

export const directPurchaseSchema = z.object({
  provider_id: z.string().uuid("Selecciona un proveedor"),
  purchase_date: z
    .string()
    .min(1, "La fecha es obligatoria")
    .refine((d) => d <= bogotaToday(), "La fecha no puede ser futura"),
  items: z
    .array(directPurchaseItemSchema)
    .min(1, "Agrega al menos un producto"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  payment_method: z.enum(["cash", "credit"]).default("cash"),
  due_date: z.string().trim().optional().or(z.literal("")),
});

export type DirectPurchaseInput = z.infer<typeof directPurchaseSchema>;
