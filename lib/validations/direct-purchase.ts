import { z } from "zod";

const today = () => new Date().toISOString().slice(0, 10);

// Acepta strings con coma o punto como separador decimal (uso colombiano)
// además de números nativos. Convierte la coma a punto y luego valida.
const decimal = (errorMessage: string) =>
  z.preprocess(
    (v) => {
      if (typeof v === "string") {
        const s = v.trim().replace(",", ".");
        if (s === "") return v;
        const n = Number(s);
        return Number.isNaN(n) ? v : n;
      }
      return v;
    },
    z.number({ message: errorMessage }),
  );

export const directPurchaseItemSchema = z.object({
  product_id: z.string().uuid("Selecciona un producto"),
  quantity: decimal("Cantidad inválida").refine(
    (n) => n > 0,
    "La cantidad debe ser mayor a 0",
  ),
  total_cost: decimal("Costo inválido").refine(
    (n) => n > 0,
    "El costo debe ser mayor a 0",
  ),
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
