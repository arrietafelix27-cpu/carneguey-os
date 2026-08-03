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

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirm: z.string().min(1, "Confirma la contraseña"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

export type NewPasswordInput = z.infer<typeof newPasswordSchema>;

export const resetRequestSchema = z.object({
  email: z.string().min(1, "El correo es obligatorio").email("Correo no válido"),
});

export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
