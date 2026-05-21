import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type Category,
} from "@/lib/catalog";
import { formatQty } from "@/lib/format";
import {
  SalesCountEditor,
  type CountItem,
} from "@/components/admin/sales-count-editor";

export const metadata = { title: "Conteo · Carnegüey OS" };

type AdminItem = {
  id: string;
  product_name: string;
  category: Category;
  unit: "kg" | "unit";
  theoretical_quantity: number;
  physical_quantity: number | null;
};

export default async function ConteoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: count } = await supabase
    .from("physical_counts")
    .select("id, status, completed_at, created_at")
    .eq("id", id)
    .single();

  if (!count) redirect("/admin/conteo");

  const { data: rawItems } = await supabase
    .from("v_physical_count_items_admin")
    .select(
      "id, product_name, category, unit, theoretical_quantity, physical_quantity",
    )
    .eq("physical_count_id", id);

  const items: AdminItem[] = (rawItems ?? []).map((r) => ({
    id: r.id as string,
    product_name: r.product_name as string,
    category: r.category as Category,
    unit: (r.unit as "kg" | "unit") ?? "kg",
    theoretical_quantity: Number(r.theoretical_quantity),
    physical_quantity:
      r.physical_quantity === null ? null : Number(r.physical_quantity),
  }));

  const inProgress = count.status === "in_progress";

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/admin/conteo"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Conteo
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {inProgress ? "Conteo en curso" : "Conteo cerrado"}
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {inProgress
          ? "Ingresa lo vendido en el período. Se guarda solo."
          : `Cerrado el ${format(
              new Date((count.completed_at ?? count.created_at) as string),
              "dd/MM/yyyy",
            )}.`}
      </p>

      {inProgress ? (
        <SalesCountEditor
          countId={id}
          initialItems={items
            .sort((a, b) => a.product_name.localeCompare(b.product_name, "es"))
            .map<CountItem>((it) => ({
              id: it.id,
              product_name: it.product_name,
              category: it.category,
              unit: it.unit,
              theoretical: it.theoretical_quantity,
              sold:
                it.physical_quantity === null
                  ? ""
                  : String(it.physical_quantity),
            }))}
        />
      ) : (
        <ReadOnlySummary items={items} />
      )}
    </main>
  );
}

function ReadOnlySummary({ items }: { items: AdminItem[] }) {
  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: items
      .filter((it) => it.category === cat)
      .sort((a, b) => a.product_name.localeCompare(b.product_name, "es")),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Este conteo no tuvo productos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(({ cat, items: group }) => (
        <section key={cat}>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_LABELS[cat]}
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Producto</th>
                  <th className="px-3 py-2 text-right font-medium">Había</th>
                  <th className="px-3 py-2 text-right font-medium">Vendido</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Debía quedar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {group.map((it) => {
                  const sold = it.physical_quantity ?? 0;
                  const expected = it.theoretical_quantity - sold;
                  return (
                    <tr key={it.id}>
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {it.product_name}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatQty(it.theoretical_quantity)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                        {formatQty(sold)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-foreground">
                        {formatQty(expected)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
