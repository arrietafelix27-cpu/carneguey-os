import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Provider } from "@/lib/catalog";
import { LiveLotForm } from "@/components/admin/live-lot-form";

export const metadata = { title: "Ganado en pie · Carnegüey OS" };

export default async function NuevoEnPiePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("providers")
    .select("id, name, phone, active")
    .eq("active", true)
    .order("name");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">
        Registrar ganado en pie
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        El lote queda pendiente hasta que la cajera registre la llegada de las
        canales.
      </p>
      <LiveLotForm providers={(data ?? []) as Provider[]} />
    </main>
  );
}
