import { z } from "zod";

export const providerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "Nombre demasiado largo"),
  phone: z
    .string()
    .trim()
    .max(40, "Teléfono demasiado largo")
    .optional()
    .or(z.literal("")),
});

export type ProviderInput = z.infer<typeof providerSchema>;
