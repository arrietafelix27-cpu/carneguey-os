"use server";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };

/**
 * Cambia la contraseña del usuario autenticado y limpia la bandera de
 * cambio obligatorio. Usa la sesión propia (no service_role).
 */
export async function changePassword(password: string): Promise<Result> {
  if (typeof password !== "string" || password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autorizado" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: `No se pudo cambiar la contraseña: ${error.message}` };
  }

  // Limpia el cambio obligatorio (función definer acotada a auth.uid()).
  await supabase.rpc("fn_clear_must_change_password");

  return { ok: true };
}

/**
 * Envía el correo de recuperación. Respuesta siempre genérica: no se revela
 * si el correo existe. Requiere SMTP configurado en Supabase.
 */
export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const clean = String(email ?? "").trim();
  if (clean) {
    const supabase = await createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await supabase.auth.resetPasswordForEmail(clean, {
      redirectTo: `${site}/auth/callback?next=/actualizar-clave`,
    });
  }
  return { ok: true };
}
