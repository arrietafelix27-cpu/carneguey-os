import Link from "next/link";
import { ShoppingCart, ChevronRight } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

export default async function EmployeeHome() {
  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Punto de operación
      </p>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">
        Hola, {profile.full_name}
      </h1>

      <Link
        href="/empleado/compras"
        className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-transform active:scale-[0.98]"
      >
        <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
          <ShoppingCart className="size-5" />
        </span>
        <span className="flex-1">
          <span className="block font-semibold text-foreground">Compras</span>
          <span className="block text-sm text-muted-foreground">
            Registrar mercancía que llega
          </span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>

      <p className="mt-6 text-sm text-muted-foreground">
        Desposte e inventario se habilitarán en los próximos pasos.
      </p>
    </main>
  );
}
