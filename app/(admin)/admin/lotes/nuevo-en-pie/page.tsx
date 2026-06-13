import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveProviders } from "@/lib/cache";
import { LiveLotForm } from "@/components/admin/live-lot-form";

export const metadata = { title: "Ganado en pie · Carnegüey OS" };

export default async function NuevoEnPiePage() {
  const providers = await getActiveProviders();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/admin/operaciones"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Operaciones
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">
        Registrar ganado en pie
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        El lote queda pendiente hasta que la cajera registre la llegada de las
        canales.
      </p>
      <LiveLotForm providers={providers} />
    </main>
  );
}
