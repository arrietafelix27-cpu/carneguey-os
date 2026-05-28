import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Raíz: única fuente de verdad para la redirección por rol después de
 * iniciar sesión. El middleware solo refresca la sesión; aquí decidimos
 * el home según el rol.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) redirect("/login");

  redirect(profile.role === "admin" ? "/admin" : "/empleado");
}
