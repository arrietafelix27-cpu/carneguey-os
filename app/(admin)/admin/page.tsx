import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { LogoutButton } from "@/components/shared/logout-button";

export default async function AdminHome() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") redirect("/empleado");

  return (
    <main className="min-h-[100dvh] bg-secondary">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Panel de administración
          </p>
          <h1 className="text-lg font-bold text-foreground">
            Hola, {profile.full_name}
          </h1>
        </div>
        <LogoutButton />
      </header>

      <section className="px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">
          El módulo de inventario se irá habilitando en los próximos pasos.
        </p>
      </section>
    </main>
  );
}
