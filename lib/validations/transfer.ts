import { z } from "zod";
import { coerceDecimal } from "@/lib/validations/decimal";

export const cutTransferSchema = z
  .object({
    source_product_id: z.string().uuid("Elige el corte de origen"),
    dest_product_id: z.string().uuid("Elige el corte de destino"),
    quantity_kg: coerceDecimal(
      z.number({ message: "Cantidad inválida" }).positive("Debe ser mayor a 0"),
    ),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.source_product_id !== v.dest_product_id, {
    message: "El origen y el destino deben ser distintos",
    path: ["dest_product_id"],
  });

export type CutTransferInput = z.infer<typeof cutTransferSchema>;
