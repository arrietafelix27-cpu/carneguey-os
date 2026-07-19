import { z } from "zod";
import { coerceDecimal } from "@/lib/validations/decimal";

const today = () => new Date().toISOString().slice(0, 10);

export const carcassLotSchema = z.object({
  type: z.enum(["beef_carcass", "pork_carcass", "poultry_carcass"]),
  provider_id: z.string().uuid("Selecciona un proveedor"),
  carcass_count: coerceDecimal(
    z
      .number({ message: "Cantidad inválida" })
      .int("Debe ser un número entero")
      .min(1, "Mínimo 1"),
  ),
  carcass_weight_kg: coerceDecimal(
    z
      .number({ message: "Peso inválido" })
      .positive("El peso debe ser mayor a 0"),
  ),
  carcass_purchase_cost: coerceDecimal(
    z
      .number({ message: "Costo inválido" })
      .positive("El costo debe ser mayor a 0"),
  ),
  arrival_date: z
    .string()
    .min(1, "La fecha es obligatoria")
    .refine((d) => d <= today(), "La fecha no puede ser futura"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  payment_method: z.enum(["cash", "credit"]).default("cash"),
  due_date: z.string().trim().optional().or(z.literal("")),
});

export type CarcassLotInput = z.infer<typeof carcassLotSchema>;

const cost0 = coerceDecimal(
  z
    .number({ message: "Costo inválido" })
    .min(0, "No puede ser negativo"),
);

export const liveLotSchema = z.object({
  provider_id: z.string().uuid("Selecciona un proveedor"),
  live_animal_count: coerceDecimal(
    z
      .number({ message: "Cantidad inválida" })
      .int("Debe ser un número entero")
      .min(1, "Mínimo 1 animal"),
  ),
  live_weight_kg: coerceDecimal(
    z
      .number({ message: "Peso inválido" })
      .positive("El peso debe ser mayor a 0"),
  ),
  live_purchase_cost: coerceDecimal(
    z
      .number({ message: "Costo inválido" })
      .positive("El costo debe ser mayor a 0"),
  ),
  transport_to_slaughter_cost: cost0,
  slaughter_cost: cost0,
  transport_to_shop_cost: cost0,
  other_costs: cost0,
  live_purchase_date: z
    .string()
    .min(1, "La fecha es obligatoria")
    .refine((d) => d <= today(), "La fecha no puede ser futura"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  payment_method: z.enum(["cash", "credit"]).default("cash"),
  due_date: z.string().trim().optional().or(z.literal("")),
});

export type LiveLotInput = z.infer<typeof liveLotSchema>;

export const lotArrivalSchema = z.object({
  lot_id: z.string().uuid("Lote inválido"),
  carcass_count: coerceDecimal(
    z
      .number({ message: "Cantidad inválida" })
      .int("Debe ser un número entero")
      .min(1, "Mínimo 1 canal"),
  ),
  carcass_weight_kg: coerceDecimal(
    z
      .number({ message: "Peso inválido" })
      .positive("El peso debe ser mayor a 0"),
  ),
  arrival_date: z
    .string()
    .min(1, "La fecha es obligatoria")
    .refine((d) => d <= today(), "La fecha no puede ser futura"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type LotArrivalInput = z.infer<typeof lotArrivalSchema>;
