import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/catalog";
import {
  DesposteProgress,
  type DesposteItem,
} from "@/components/employee/desposte-progress";

export const metadata = { title: "Desposte en curso" };

// Esta pantalla debe ver SIEMPRE el catálogo más reciente — no cachea.
// El caché global (lib/cache) no se invalida si los productos se editan
// directo en Supabase, y eso ocultaba productos como Hígado o Galillo.
export const dynamic = "force-dynamic";

export default async function DesposteEnCursoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: desposte } = await supabase
    .from("despostes")
    .select("id, lot_id, input_weight_kg, status")
    .eq("id", id)
    .single();

  if (!desposte || desposte.status !== "in_progress") {
    redirect("/empleado/desposte");
  }

  const { data: lot } = await supabase
    .from("v_purchase_lots_employee")
    .select("lot_code, type")
    .eq("id", desposte.lot_id)
    .single();

  const category =
    lot?.type === "pork_carcass"
      ? "pork"
      : lot?.type === "poultry_carcass"
        ? "poultry"
        : "beef";

  // Productos siempre frescos desde la base, no del caché.
  const [{ data: allProducts }, { data: items }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, category, unit, origin, pos_code, active, shared_across_species",
      )
      .eq("active", true)
      .order("name"),
    supabase
      .from("desposte_items")
      .select("id, product_id, weight_kg, unit_count, products(name, unit)")
      .eq("desposte_id", id)
      .order("created_at", { ascending: true }),
  ]);

  // Filtro por el spec:
  //  - beef/pork: misma categoría + origin='from_processing'
  //  - poultry: misma categoría (cualquier origen, ver migración 009)
  //  - shared_across_species: aparece en cualquier especie (migración 016)
  // El stock NO entra en el filtro: todos los productos válidos aparecen
  // siempre, tengan o no inventario previo.
  const products = ((allProducts ?? []) as Product[]).filter((p) => {
    if (p.shared_across_species) return true;
    if (lot?.type === "poultry_carcass") return p.category === "poultry";
    return p.category === category && p.origin === "from_processing";
  });

  const initialItems: DesposteItem[] = (items ?? []).map((it) => {
    const prod = it.products as unknown as { name: string; unit: string } | null;
    const rawUnitCount = (it as { unit_count?: number | null }).unit_count;
    return {
      id: it.id as string,
      product_id: it.product_id as string,
      product_name: prod?.name ?? "Producto",
      product_unit: (prod?.unit === "unit" ? "unit" : "kg") as "kg" | "unit",
      weight_kg: Number(it.weight_kg),
      unit_count:
        rawUnitCount === null || rawUnitCount === undefined
          ? null
          : Number(rawUnitCount),
    };
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/empleado/desposte"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Despostes
      </Link>
      <DesposteProgress
        desposteId={desposte.id as string}
        lotCode={lot?.lot_code ?? "Lote"}
        inputWeight={Number(desposte.input_weight_kg)}
        products={products}
        initialItems={initialItems}
      />
    </main>
  );
}
