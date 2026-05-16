import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "El correo es obligatorio")
    .email("Correo no válido"),
  password: z
    .string()
    .min(4, "La contraseña debe tener al menos 4 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;
