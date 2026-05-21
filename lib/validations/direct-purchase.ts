import { z } from "zod";

const today = () => new Date().toISOString().slice(0, 10);

export const directPurchaseItemSchema = z.object({
  product_id: z.string().uuid("Selecciona un producto"),
  quantity: z.coerce
    .number({ message: "Cantidad inválida" })
    .positive("La cantidad debe ser mayor a 0"),
  total_cost: z.coerce
    .number({ message: "Costo inválido" })
    .positive("El costo debe ser mayor a 0"),
});

export const directPurchaseSchema = z.object({
  provider_id: z.string().uuid("Selecciona un proveedor"),
  purchase_date: z
    .string()
    .min(1, "La fecha es obligatoria")
    .refine((d) => d <= today(), "La fecha no puede ser futura"),
  items: z
    .array(directPurchaseItemSchema)
    .min(1, "Agrega al menos un producto"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type DirectPurchaseInput = z.infer<typeof directPurchaseSchema>;
