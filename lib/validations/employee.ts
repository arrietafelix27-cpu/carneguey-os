import { z } from "zod";

export const employeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "Nombre demasiado largo"),
  role: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  // Llega como texto desde el formulario; se limpia en la acción.
  salary: z.string().optional(),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
