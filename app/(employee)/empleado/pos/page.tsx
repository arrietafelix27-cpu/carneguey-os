import { createClient } from "@/lib/supabase/server";
import { PosTerminal, type PosProduct } from "@/components/employee/pos-terminal";

export const metadata = { title: "POS · Carnegüey" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const supabase = await createClient();

  // Caché de productos activos con precio de venta (v_pos_products, definer).
  const { data } = await supabase
    .from("v_pos_products")
    .select("id, pos_code, name, category, unit, price")
    .order("name", { ascending: true });

  const products: PosProduct[] = (data ?? [])
    .filter((p) => p.pos_code != null)
    .map((p) => ({
      id: p.id as string,
      pos_code: p.pos_code as string,
      name: p.name as string,
      unit: (p.unit as "kg" | "unit") ?? "kg",
      price: p.price === null || p.price === undefined ? 0 : Number(p.price),
    }));

  return <PosTerminal products={products} />;
}
