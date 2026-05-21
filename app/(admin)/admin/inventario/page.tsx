import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/catalog";
import { formatQty, formatCOP } from "@/lib/format";

export const metadata = { title: "Inventario · Carnegüey OS" };

type Row = {
  product_id: string;
  product_name: string;
  category: Category;
  unit: "kg" | "unit";
  quantity_in_stock: number;
  weighted_avg_unit_cost: number;
  total_value: number;
};

export default async function InventarioPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_current_inventory")
    .select(
      "product_id, product_name, category, unit, active, quantity_in_stock, weighted_avg_unit_cost, total_value",
    )
    .eq("active", true);

  const rows = ((data ?? []) as (Row & { active: boolean })[])
    .map((r) => ({
      ...r,
      quantity_in_stock: Number(r.quantity_in_stock),
      weighted_avg_unit_cost: Number(r.weighted_avg_unit_cost),
      total_value: Number(r.total_value),
    }))
    .sort((a, b) => a.product_name.localeCompare(b.product_name, "es"));

  const grandTotal = rows.reduce((s, r) => s + r.total_value, 0);

  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: rows.filter((r) => r.category === cat),
  })).filter((g) => g.items.length > 0);

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
      <p className="mb-4 text-sm text-muted-foreground">
        Lo que debería haber según los registros.
      </p>

      <div className="mb-6 rounded-xl bg-primary px-5 py-4 text-primary-foreground">
        <p className="text-xs uppercase tracking-wide opacity-80">
          Valor total del inventario
        </p>
        <p className="text-3xl font-bold">{formatCOP(grandTotal)}</p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay movimientos de inventario registrados.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ cat, items }) => {
            const subtotal = items.reduce((s, r) => s + r.total_value, 0);
            return (
              <section key={cat}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {formatCOP(subtotal)}
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Producto</th>
                        <th className="px-3 py-2 text-right font-medium">
                          Stock
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Costo/u
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((r) => (
                        <tr key={r.product_id}>
                          <td className="px-3 py-2.5 font-medium text-foreground">
                            {r.product_name}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                            {formatQty(r.quantity_in_stock)}{" "}
                            <span className="text-xs text-muted-foreground">
                              {r.unit === "kg" ? "kg" : "u"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {formatCOP(r.weighted_avg_unit_cost)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">
                            {formatCOP(r.total_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
