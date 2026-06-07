import { z } from "zod";
import { coerceDecimal } from "@/lib/validations/decimal";

// unit_count opcional: número entero positivo, o null/vacío para productos kg.
const optionalUnitCount = z
  .preprocess(
    (v) => {
      if (v === null || v === undefined || v === "") return null;
      if (typeof v === "string") {
        const s = v.trim();
        if (s === "") return null;
        const n = Number(s);
        return Number.isNaN(n) ? v : n;
      }
      return v;
    },
    z
      .number({ message: "Cantidad inválida" })
      .int("Debe ser un número entero")
      .positive("Mínimo 1")
      .nullable(),
  )
  .optional();

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
  unit_count: optionalUnitCount,
});

export type StartDesposteInput = z.infer<typeof startDesposteSchema>;
export type DesposteItemInput = z.infer<typeof desposteItemSchema>;
