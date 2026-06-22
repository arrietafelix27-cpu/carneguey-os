import { z } from "zod";
import { coerceDecimal } from "@/lib/validations/decimal";

const itemSchema = z.object({
  product_id: z.string().uuid("Producto inválido"),
  weight_kg: coerceDecimal(
    z.number({ message: "Peso inválido" }).positive("Debe ser mayor a 0"),
  ),
  unit_count: coerceDecimal(
    z.number().int("Unidades enteras").positive(),
  )
    .nullable()
    .optional(),
});

export const subDesposteSchema = z.object({
  source_product_id: z.string().uuid("Elige el producto de origen"),
  source_kg: coerceDecimal(
    z.number({ message: "Cantidad inválida" }).positive("Debe ser mayor a 0"),
  ),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(itemSchema)
    .min(1, "Agrega al menos un producto resultante"),
});

export type SubDesposteInput = z.infer<typeof subDesposteSchema>;
