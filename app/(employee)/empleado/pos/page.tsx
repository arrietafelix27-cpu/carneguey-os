import { createClient } from "@/lib/supabase/server";
import {
  PosTerminal,
  type PosProduct,
  type PosCustomer,
} from "@/components/employee/pos-terminal";

export const metadata = { title: "POS" };
export const dynamic = "force-dynamic";

export default async function PosPage() {
  const supabase = await createClient();

  // Caché en memoria: productos activos con precio de venta y clientes activos.
  // Ambas vistas son definer y no exponen costos, cupo de crédito ni notas.
  const [{ data: products }, { data: customers }] = await Promise.all([
    supabase
      .from("v_pos_products")
      .select("id, pos_code, name, category, unit, price")
      .order("name", { ascending: true }),
    supabase
      .from("v_pos_customers")
      .select("id, name, discount_type, discount_value")
      .order("name", { ascending: true }),
  ]);

  const productList: PosProduct[] = (products ?? [])
    .filter((p) => p.pos_code != null)
    .map((p) => ({
      id: p.id as string,
      pos_code: p.pos_code as string,
      name: p.name as string,
      unit: (p.unit as "kg" | "unit") ?? "kg",
      price: p.price === null || p.price === undefined ? 0 : Number(p.price),
    }));

  const customerList: PosCustomer[] = (customers ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    discount_type:
      (c.discount_type as "percentage" | "fixed_per_product" | null) ?? null,
    discount_value: Number(c.discount_value ?? 0),
  }));

  return <PosTerminal products={productList} customers={customerList} />;
}
