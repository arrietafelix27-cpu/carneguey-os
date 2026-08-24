import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/catalog";
import { readOrgScalePattern } from "@/lib/actions/scale";
import { ProductsManager } from "@/components/admin/products-manager";

export const metadata = { title: "Productos" };

export default async function ProductosPage() {
  const supabase = await createClient();
  const scalePattern = await readOrgScalePattern(supabase);
  // v_products_admin incluye price y solo devuelve filas al admin (migración 018).
  const { data } = await supabase
    .from("v_products_admin")
    .select(
      "id, name, category, unit, origin, pos_code, active, shared_across_species, price",
    )
    .order("name", { ascending: true });

  const products: Product[] = (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    category: p.category as Product["category"],
    unit: p.unit as Product["unit"],
    origin: p.origin as Product["origin"],
    pos_code: (p.pos_code as string | null) ?? null,
    active: p.active as boolean,
    shared_across_species: (p.shared_across_species as boolean) ?? false,
    price: p.price === null || p.price === undefined ? null : Number(p.price),
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>
      <ProductsManager
        initialProducts={products}
        hasScalePattern={scalePattern !== null}
      />
    </main>
  );
}
