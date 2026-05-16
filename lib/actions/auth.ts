"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

type LoginResult = { error: string };

// Mensaje genérico: no revelar si el correo existe (spec §7.1).
const GENERIC_ERROR = "Correo o contraseña incorrectos";

export async function login(values: unknown): Promise<LoginResult | void> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Revisa los datos ingresados" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: GENERIC_ERROR };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", data.user.id)
    .single();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    return { error: "Tu cuenta no está activa. Contacta al administrador." };
  }

  redirect(profile.role === "admin" ? "/admin" : "/empleado");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
