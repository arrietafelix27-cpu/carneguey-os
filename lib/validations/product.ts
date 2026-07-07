import { z } from "zod";

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "Nombre demasiado largo"),
  category: z.enum(["beef", "pork", "poultry", "other"], {
    message: "Selecciona una categoría",
  }),
  unit: z.enum(["kg", "unit"], { message: "Selecciona una unidad" }),
  origin: z.enum(["from_processing", "direct_purchase"], {
    message: "Selecciona el origen",
  }),
  pos_code: z
    .string()
    .trim()
    .max(60, "Código demasiado largo")
    .optional()
    .or(z.literal("")),
  shared_across_species: z.boolean().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
