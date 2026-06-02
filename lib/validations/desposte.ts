import { z } from "zod";
import { coerceDecimal } from "@/lib/validations/decimal";

export const startDesposteSchema = z.object({
  lot_id: z.string().uuid("Lote inválido"),
  input_weight_kg: coerceDecimal(
    z
      .number({ message: "Peso inválido" })
      .positive("El peso debe ser mayor a 0"),
  ),
});

export const desposteItemSchema = z.object({
  desposte_id: z.string().uuid("Desposte inválido"),
  product_id: z.string().uuid("Selecciona un producto"),
  weight_kg: coerceDecimal(
    z
      .number({ message: "Peso inválido" })
      .positive("El peso debe ser mayor a 0"),
  ),
});

export type StartDesposteInput = z.infer<typeof startDesposteSchema>;
export type DesposteItemInput = z.infer<typeof desposteItemSchema>;
