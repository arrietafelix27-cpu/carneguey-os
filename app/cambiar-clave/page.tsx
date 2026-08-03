import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "@/components/shared/change-password-form";

export const metadata = { title: "Cambiar contraseña" };
export const dynamic = "force-dynamic";

export default async function CambiarClavePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) redirect("/login");

  const forced = profile.must_change_password === true;

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-secondary px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {forced ? "Crea tu contraseña" : "Cambiar contraseña"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {forced
              ? "Por seguridad, elige una contraseña nueva para continuar."
              : "Elige una contraseña nueva para tu cuenta."}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-md sm:p-8">
          <ChangePasswordForm submitLabel={forced ? "Continuar" : "Guardar"} />
        </div>

        {!forced && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link href="/" className="text-primary">
              Volver
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
