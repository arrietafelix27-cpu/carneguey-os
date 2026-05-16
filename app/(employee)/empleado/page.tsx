import { getCurrentProfile } from "@/lib/auth";
import { LogoutButton } from "@/components/shared/logout-button";

export default async function EmployeeHome() {
  const profile = await getCurrentProfile();

  return (
    <main className="min-h-[100dvh] bg-secondary">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Punto de operación
          </p>
          <h1 className="text-lg font-bold text-foreground">
            Hola, {profile.full_name}
          </h1>
        </div>
        <LogoutButton />
      </header>

      <section className="px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Las compras, despostes y conteos se irán habilitando en los próximos
          pasos.
        </p>
      </section>
    </main>
  );
}
