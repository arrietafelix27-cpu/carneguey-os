import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Para Server Actions: devuelve el cliente y si el llamador es admin activo.
 * No redirige (las actions devuelven error en su lugar).
 */
export async function getAdminContext(): Promise<{
  supabase: SupabaseClient;
  isAdmin: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, isAdmin: false };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();
  return {
    supabase,
    isAdmin: !!profile && profile.active && profile.role === "admin",
  };
}

export type Profile = {
  id: string;
  full_name: string;
  role: "admin" | "employee";
  active: boolean;
};

/**
 * Devuelve el perfil del usuario autenticado. Si no hay sesión o la cuenta
 * está inactiva, redirige a /login. Usar en Server Components.
 *
 * Memoizado con React `cache()`: múltiples llamadas dentro del mismo
 * request (layout + página) reusan el mismo resultado, eliminando consultas
 * duplicadas a Supabase.
 */
export const getCurrentProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  return profile as Profile;
});
