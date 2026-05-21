import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ResetDataButton } from "@/components/admin/reset-data-button";

export const metadata = { title: "Configuración · Carnegüey OS" };

export default function ConfiguracionPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="mb-5 text-2xl font-bold tracking-tight text-foreground">
        Configuración
      </h1>

      <section className="rounded-xl border border-destructive/30 bg-card p-5">
        <h2 className="font-semibold text-foreground">Zona delicada</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Borra todos los datos de inventario para empezar de cero. Útil para
          limpiar los datos de prueba antes de usar la app de verdad. No toca
          productos, proveedores ni usuarios.
        </p>
        <ResetDataButton />
      </section>
    </main>
  );
}
