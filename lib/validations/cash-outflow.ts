import { z } from "zod";

export const OUTFLOW_CATEGORIES = [
  "sf",
  "employee_advance",
  "supplier_payment",
  "expense",
  "other",
] as const;

export type OutflowCategory = (typeof OUTFLOW_CATEGORIES)[number];

export const OUTFLOW_LABELS: Record<OutflowCategory, string> = {
  sf: "Señor Félix (SF)",
  employee_advance: "Adelanto a empleado",
  supplier_payment: "Pago a proveedor",
  expense: "Gasto operativo en efectivo",
  other: "Otro",
};

/** Categorías que quedan pendientes de aprobación de Félix. */
export const NEEDS_APPROVAL: OutflowCategory[] = ["sf", "employee_advance"];

export const EXPENSE_SUBCATEGORIES = [
  "utilities",
  "fuel",
  "supplies",
  "maintenance",
  "food",
  "other",
] as const;

export type ExpenseSubcategory = (typeof EXPENSE_SUBCATEGORIES)[number];

export const SUBCATEGORY_LABELS: Record<ExpenseSubcategory, string> = {
  utilities: "Servicios públicos",
  fuel: "Gasolina",
  supplies: "Insumos y bolsas",
  maintenance: "Mantenimiento",
  food: "Alimentación",
  other: "Otro",
};

export const cashOutflowSchema = z.object({
  category: z.enum(OUTFLOW_CATEGORIES, { message: "Elige la categoría" }),
  amount: z.string().min(1, "Ingresa el monto"),
  recipient: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CashOutflowInput = z.infer<typeof cashOutflowSchema>;
