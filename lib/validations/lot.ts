import { z } from "zod";

const today = () => new Date().toISOString().slice(0, 10);

export const carcassLotSchema = z.object({
  type: z.enum(["beef_carcass", "pork_carcass"]),
  provider_id: z.string().uuid("Selecciona un proveedor"),
  carcass_count: z.coerce
    .number({ message: "Cantidad inválida" })
    .int("Debe ser un número entero")
    .min(1, "Mínimo 1"),
  carcass_weight_kg: z.coerce
    .number({ message: "Peso inválido" })
    .positive("El peso debe ser mayor a 0"),
  carcass_purchase_cost: z.coerce
    .number({ message: "Costo inválido" })
    .positive("El costo debe ser mayor a 0"),
  arrival_date: z
    .string()
    .min(1, "La fecha es obligatoria")
    .refine((d) => d <= today(), "La fecha no puede ser futura"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CarcassLotInput = z.infer<typeof carcassLotSchema>;
