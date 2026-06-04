import { createClient } from "@/lib/supabase/server";
import {
  DesposteStart,
  type ActiveLot,
  type OngoingDesposte,
} from "@/components/employee/desposte-start";

export const metadata = { title: "Desposte · Carnegüey" };

export default async function DespostePage() {
  const supabase = await createClient();

  const [{ data: lots }, { data: despostes }] = await Promise.all([
    supabase
      .from("v_purchase_lots_employee")
      .select("id, lot_code, type, carcass_weight_kg, status")
      .in("type", ["beef_live", "beef_carcass", "pork_carcass", "poultry_carcass"])
      .eq("status", "active"),
    supabase
      .from("despostes")
      .select("id, lot_id, input_weight_kg, status, desposte_date")
      .order("created_at", { ascending: false }),
  ]);

  const finalizedByLot = new Map<string, number>();
  for (const d of despostes ?? []) {
    if (d.status === "finalized") {
      finalizedByLot.set(
        d.lot_id as string,
        (finalizedByLot.get(d.lot_id as string) ?? 0) +
          Number(d.input_weight_kg),
      );
    }
  }

  const activeLots: ActiveLot[] = (lots ?? []).map((l) => {
    const total = Number(l.carcass_weight_kg ?? 0);
    const done = finalizedByLot.get(l.id as string) ?? 0;
    return {
      id: l.id as string,
      lot_code: l.lot_code as string,
      type: l.type as string,
      kg_remaining: Math.round((total - done) * 100) / 100,
    };
  });

  // Lotes con kg disponibles (tolerancia 0.5 kg).
  const availableLots = activeLots.filter((l) => l.kg_remaining > 0.5);

  const lotCodeById = new Map(
    (lots ?? []).map((l) => [l.id as string, l.lot_code as string]),
  );

  const ongoing: OngoingDesposte[] = (despostes ?? [])
    .filter((d) => d.status === "in_progress")
    .map((d) => ({
      id: d.id as string,
      lot_code: lotCodeById.get(d.lot_id as string) ?? "Lote",
      input_weight_kg: Number(d.input_weight_kg),
    }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-foreground">
        Desposte
      </h1>
      <DesposteStart ongoing={ongoing} lots={availableLots} />
    </main>
  );
}
