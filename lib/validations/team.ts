import { z } from "zod";

export const createTeamUserSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "Nombre demasiado largo"),
  email: z
    .string()
    .trim()
    .min(1, "El correo es obligatorio")
    .email("Correo no válido"),
  role: z.enum(["admin", "employee"], { message: "Elige el rol" }),
  password: z
    .string()
    .min(8, "La contraseña temporal debe tener al menos 8 caracteres"),
});

export type CreateTeamUserInput = z.infer<typeof createTeamUserSchema>;
