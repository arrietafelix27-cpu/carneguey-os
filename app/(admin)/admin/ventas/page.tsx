import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format, addDays } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { bogotaToday } from "@/lib/dates";
import {
  VentasHistoryManager,
  type SaleRow,
  type SaleItemRow,
  type CustomerOption,
} from "@/components/admin/ventas-history-manager";

export const metadata = { title: "Historial de ventas" };
export const dynamic = "force-dynamic";

function defaultFrom(): string {
  return bogotaToday().slice(0, 7) + "-01";
}

export default async function VentasHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const from = sp.from || defaultFrom();
  const to = sp.to || bogotaToday();
  const customerId = sp.customer_id || "";
  const method = sp.method || "";
  const q = (sp.q || "").trim();

  const supabase = await createClient();

  const { data: customersData } = await supabase
    .from("customers")
    .select("id, name")
    .order("name", { ascending: true });

  const customers: CustomerOption[] = (customersData ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
  }));
  const customerName = new Map(customers.map((c) => [c.id, c.name]));

  // Si hay filtro por producto, primero resolvemos qué ventas lo contienen.
  let saleIdsFromProduct: string[] | null = null;
  if (q !== "") {
    const { data: matchingProducts } = await supabase
      .from("products")
      .select("id")
      .ilike("name", `%${q}%`);
    const productIds = (matchingProducts ?? []).map((p) => p.id as string);
    if (productIds.length === 0) {
      saleIdsFromProduct = [];
    } else {
      const { data: matchingItems } = await supabase
        .from("sale_items")
        .select("sale_id")
        .in("product_id", productIds);
      saleIdsFromProduct = [
        ...new Set((matchingItems ?? []).map((it) => it.sale_id as string)),
      ];
    }
  }

  let sales: SaleRow[] = [];
  let truncated = false;

  if (saleIdsFromProduct === null || saleIdsFromProduct.length > 0) {
    const fromStart = `${from}T00:00:00-05:00`;
    const toEndExclusive = `${format(
      addDays(new Date(`${to}T00:00:00-05:00`), 1),
      "yyyy-MM-dd",
    )}T00:00:00-05:00`;

    let query = supabase
      .from("sales")
      .select(
        "id, created_at, payment_method, subtotal, discount_total, total, status, customer_id",
      )
      .gte("created_at", fromStart)
      .lt("created_at", toEndExclusive)
      .order("created_at", { ascending: false })
      .limit(500);

    if (customerId) query = query.eq("customer_id", customerId);
    if (method) query = query.eq("payment_method", method);
    if (saleIdsFromProduct !== null) query = query.in("id", saleIdsFromProduct);

    const { data: salesData } = await query;
    truncated = (salesData ?? []).length === 500;

    const saleIds = (salesData ?? []).map((s) => s.id as string);

    const itemsBySale = new Map<string, SaleItemRow[]>();
    if (saleIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("sale_items")
        .select("id, sale_id, product_id, quantity, unit_price, total_price")
        .in("sale_id", saleIds);

      const productIds = [
        ...new Set((itemsData ?? []).map((it) => it.product_id as string)),
      ];
      const { data: productsData } =
        productIds.length > 0
          ? await supabase
              .from("products")
              .select("id, name, unit")
              .in("id", productIds)
          : { data: [] };
      const productMap = new Map(
        (productsData ?? []).map((p) => [
          p.id as string,
          { name: p.name as string, unit: p.unit as "kg" | "unit" },
        ]),
      );

      for (const it of itemsData ?? []) {
        const saleId = it.sale_id as string;
        const prod = productMap.get(it.product_id as string);
        const list = itemsBySale.get(saleId) ?? [];
        list.push({
          id: it.id as string,
          productName: prod?.name ?? "Producto eliminado",
          unit: prod?.unit ?? "kg",
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          totalPrice: Number(it.total_price),
        });
        itemsBySale.set(saleId, list);
      }
    }

    sales = (salesData ?? []).map((s) => ({
      id: s.id as string,
      createdAt: s.created_at as string,
      paymentMethod: s.payment_method as string,
      subtotal: Number(s.subtotal),
      discountTotal: Number(s.discount_total),
      total: Number(s.total),
      status: s.status as string,
      customerName: s.customer_id
        ? customerName.get(s.customer_id as string) ?? null
        : null,
      items: itemsBySale.get(s.id as string) ?? [],
    }));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-9">
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Ventas
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Historial de ventas
      </h1>

      <VentasHistoryManager
        sales={sales}
        customers={customers}
        truncated={truncated}
        filters={{ from, to, customerId, method, q }}
      />
    </main>
  );
}
