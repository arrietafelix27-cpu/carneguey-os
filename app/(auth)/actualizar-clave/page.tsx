import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "@/components/shared/change-password-form";

export const metadata = { title: "Nueva contraseña" };
export const dynamic = "force-dynamic";

/**
 * Destino del enlace de recuperación (tras /auth/callback intercambiar el
 * token y dejar la sesión de recuperación activa). El usuario fija su nueva
 * contraseña aquí.
 */
export default async function ActualizarClavePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sin sesión de recuperación válida no hay nada que actualizar.
  if (!user) redirect("/login");

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-secondary px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Nueva contraseña
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige una contraseña nueva para entrar.
          </p>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-md sm:p-8">
          <ChangePasswordForm submitLabel="Guardar y entrar" />
        </div>
      </div>
    </main>
  );
}
