import Link from "next/link";
import { ShoppingCart, ChevronRight } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

export default async function EmployeeHome() {
  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Punto de operación
      </p>
      <h1 className="mb-7 mt-1 text-[34px] font-bold leading-tight tracking-tight text-foreground">
        Hola, {profile.full_name}
      </h1>

      <Link
        href="/empleado/compras"
        className="flex items-center gap-4 rounded-3xl bg-card shadow-sm p-5 transition-transform active:scale-[0.98]"
      >
        <span className="grid size-14 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-red-soft)] text-primary">
          <ShoppingCart className="size-7" strokeWidth={2} />
        </span>
        <span className="flex-1">
          <span className="block text-[19px] font-semibold text-foreground">
            Compras
          </span>
          <span className="block text-[14px] text-secondary-foreground">
            Registrar mercancía que llega
          </span>
        </span>
        <ChevronRight className="size-5 text-text-tertiary" />
      </Link>

      <p className="mt-6 px-1 text-[14px] text-secondary-foreground">
        Desposte e inventario se habilitarán en los próximos pasos.
      </p>
    </main>
  );
}
