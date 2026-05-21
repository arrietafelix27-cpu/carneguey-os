import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/catalog";
import { InventoryView, type InvItem } from "@/components/admin/inventory-view";

export const metadata = { title: "Inventario · Carnegüey OS" };

export default async function InventarioPage() {
  const supabase = await createClient();

  const [{ data: lots }, { data: products }] = await Promise.all([
    // Canales sin despostar: lotes activos con kg pendientes.
    supabase
      .from("v_lot_summary")
      .select("lot_id, lot_code, type, status, kg_remaining, cost_per_kg_carcass")
      .eq("status", "active"),
    // Productos con existencia.
    supabase
      .from("v_current_inventory")
      .select(
        "product_id, product_name, category, unit, active, quantity_in_stock, weighted_avg_unit_cost",
      ),
  ]);

  const items: InvItem[] = [];

  for (const lot of lots ?? []) {
    const kgRemaining = Number(lot.kg_remaining ?? 0);
    if (kgRemaining <= 0.5) continue; // tolerancia de balanza
    const costPerKg = Number(lot.cost_per_kg_carcass ?? 0);
    const isPork = lot.type === "pork_carcass";
    items.push({
      id: `lot-${lot.lot_id}`,
      kind: "canal",
      category: null,
      name: `${isPork ? "Cerdo" : "Res"} en canal · ${lot.lot_code}`,
      lotCode: lot.lot_code as string,
      lotId: lot.lot_id as string,
      quantity: Math.round(kgRemaining * 100) / 100,
      unit: "kg",
      unitCost: costPerKg,
      totalValue: Math.round(kgRemaining * costPerKg * 100) / 100,
    });
  }

  for (const p of products ?? []) {
    if (!p.active) continue;
    const qty = Number(p.quantity_in_stock ?? 0);
    if (qty <= 0) continue;
    const unitCost = Number(p.weighted_avg_unit_cost ?? 0);
    items.push({
      id: `prod-${p.product_id}`,
      kind: "producto",
      category: p.category as Category,
      name: p.product_name as string,
      lotCode: null,
      lotId: null,
      quantity: Math.round(qty * 100) / 100,
      unit: (p.unit as "kg" | "unit") ?? "kg",
      unitCost,
      totalValue: Math.round(qty * unitCost * 100) / 100,
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Inventario
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Lo que hay físicamente en el negocio hoy.
      </p>

      <InventoryView items={items} />
    </main>
  );
}
