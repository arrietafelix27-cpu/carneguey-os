import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAllProviders } from "@/lib/cache";
import {
  LlegadaCanalesManager,
  type PendingLot,
} from "@/components/employee/llegada-canales-manager";

export const metadata = { title: "Llegada de canales" };

export default async function LlegadaCanalesPage() {
  const supabase = await createClient();

  const [{ data: lots }, providers] = await Promise.all([
    supabase
      .from("v_purchase_lots_employee")
      .select("id, lot_code, provider_id, live_animal_count, live_purchase_date")
      .eq("type", "beef_live")
      .eq("status", "pending_arrival")
      .order("created_at", { ascending: true }),
    getAllProviders(),
  ]);

  const providerName = new Map(providers.map((p) => [p.id, p.name]));

  const pending: PendingLot[] = (lots ?? []).map((l) => ({
    id: l.id as string,
    lot_code: l.lot_code as string,
    provider_name: providerName.get(l.provider_id as string) ?? "Proveedor",
    live_animal_count: l.live_animal_count as number | null,
    live_purchase_date: l.live_purchase_date as string | null,
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/empleado/compras"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Compras
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">
        Llegada de canales
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Lotes de ganado en pie pendientes de recibir.
      </p>
      <LlegadaCanalesManager lots={pending} />
    </main>
  );
}
