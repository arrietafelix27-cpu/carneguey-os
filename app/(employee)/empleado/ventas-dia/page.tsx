import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  VentasDiaView,
  type SaleRow,
  type SaleItemRow,
} from "@/components/employee/ventas-dia-view";

export const metadata = { title: "Ventas del día · Carnegüey" };
export const dynamic = "force-dynamic";

export default async function VentasDiaPage() {
  const supabase = await createClient();

  const [{ data: sales }, { data: items }] = await Promise.all([
    supabase
      .from("v_pos_sales_today")
      .select(
        "id, created_at, payment_method, subtotal, discount_total, total, status",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("v_pos_sale_items_today")
      .select(
        "id, sale_id, product_name, unit, quantity, unit_price, total_price",
      ),
  ]);

  const itemsBySale = new Map<string, SaleItemRow[]>();
  for (const it of items ?? []) {
    const saleId = it.sale_id as string;
    const list = itemsBySale.get(saleId) ?? [];
    list.push({
      id: it.id as string,
      productName: it.product_name as string,
      unit: it.unit as "kg" | "unit",
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      totalPrice: Number(it.total_price),
    });
    itemsBySale.set(saleId, list);
  }

  const rows: SaleRow[] = (sales ?? []).map((s) => ({
    id: s.id as string,
    createdAt: s.created_at as string,
    paymentMethod: s.payment_method as string,
    subtotal: Number(s.subtotal),
    discountTotal: Number(s.discount_total),
    total: Number(s.total),
    status: s.status as string,
    items: itemsBySale.get(s.id as string) ?? [],
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/empleado"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Inicio
      </Link>

      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Caja
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Ventas del día
      </h1>

      <VentasDiaView sales={rows} />
    </main>
  );
}
