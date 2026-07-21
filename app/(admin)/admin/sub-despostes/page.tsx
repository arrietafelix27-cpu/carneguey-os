import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatQty } from "@/lib/format";
import { SubDesposteReview } from "@/components/admin/sub-desposte-review";

export const metadata = { title: "Sub-despostes · Carnegüey OS" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; bg: string; text: string }> =
  {
    approved: { label: "Aprobado", bg: "bg-success/15", text: "text-success" },
    rejected: {
      label: "Rechazado",
      bg: "bg-[var(--bg-muted)]",
      text: "text-secondary-foreground",
    },
  };

export default async function SubDespostesAdminPage() {
  const supabase = await createClient();

  const { data: subs } = await supabase
    .from("sub_despostes")
    .select(
      "id, source_product_id, source_kg, status, notes, created_by, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(60);

  const all = subs ?? [];
  const ids = all.map((s) => s.id as string);

  // Items de todos los sub-despostes mostrados.
  const itemsBy = new Map<
    string,
    { product_id: string; weight_kg: number; unit_count: number | null }[]
  >();
  if (ids.length > 0) {
    const { data: items } = await supabase
      .from("sub_desposte_items")
      .select("sub_desposte_id, product_id, weight_kg, unit_count");
    for (const it of items ?? []) {
      const sid = it.sub_desposte_id as string;
      const arr = itemsBy.get(sid) ?? [];
      arr.push({
        product_id: it.product_id as string,
        weight_kg: Number(it.weight_kg),
        unit_count:
          it.unit_count === null || it.unit_count === undefined
            ? null
            : Number(it.unit_count),
      });
      itemsBy.set(sid, arr);
    }
  }

  const productIds = new Set<string>();
  const personIds = new Set<string>();
  for (const s of all) {
    productIds.add(s.source_product_id as string);
    personIds.add(s.created_by as string);
  }
  for (const arr of itemsBy.values()) {
    for (const it of arr) productIds.add(it.product_id);
  }

  const [{ data: products }, { data: profiles }] = await Promise.all([
    productIds.size > 0
      ? supabase
          .from("products")
          .select("id, name, unit")
          .in("id", Array.from(productIds))
      : Promise.resolve({
          data: [] as { id: string; name: string; unit: string }[],
        }),
    personIds.size > 0
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(personIds))
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const prodBy = new Map(
    (products ?? []).map((p) => [
      p.id as string,
      { name: p.name as string, unit: p.unit as string },
    ]),
  );
  const personBy = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const pending = all.filter((s) => s.status === "pending");
  const history = all.filter((s) => s.status !== "pending");

  const pname = (id: string) => prodBy.get(id)?.name ?? "Producto";
  const itemAmount = (it: {
    product_id: string;
    weight_kg: number;
    unit_count: number | null;
  }) => {
    const unit = prodBy.get(it.product_id)?.unit ?? "kg";
    if (unit === "unit" && it.unit_count !== null) {
      return `${formatQty(it.unit_count)} u · ${formatQty(it.weight_kg)} kg`;
    }
    return `${formatQty(it.weight_kg)} kg`;
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Sub-despostes
      </h1>
      <p className="mb-7 mt-1 text-[15px] text-secondary-foreground">
        Transformaciones de un corte en otros. Solo al aprobar cambian el
        inventario.
      </p>

      <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Pendientes ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
          No hay sub-despostes pendientes.
        </div>
      ) : (
        <ul className="grid gap-3">
          {pending.map((s) => {
            const items = itemsBy.get(s.id as string) ?? [];
            const outKg = items.reduce((a, it) => a + it.weight_kg, 0);
            const inKg = Number(s.source_kg);
            const merma = Math.round((inKg - outKg) * 100) / 100;
            const mermaPct = inKg > 0 ? (merma / inKg) * 100 : 0;
            return (
              <li
                key={s.id as string}
                className="rounded-3xl bg-card p-5 shadow-sm"
              >
                <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                  Origen
                </p>
                <p className="text-[17px] font-semibold text-foreground">
                  {pname(s.source_product_id as string)}
                </p>
                <p className="text-[15px] font-semibold text-primary tabular-nums">
                  {formatQty(inKg)} kg
                </p>

                <p className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                  Salen
                </p>
                <ul className="mt-1 overflow-hidden rounded-2xl bg-secondary">
                  {items.map((it, i) => (
                    <li
                      key={i}
                      className={`flex items-center justify-between px-4 py-2.5 ${
                        i > 0 ? "border-t border-border" : ""
                      }`}
                    >
                      <span className="text-[14px] text-foreground">
                        {pname(it.product_id)}
                      </span>
                      <span className="text-[14px] font-semibold text-foreground tabular-nums">
                        {itemAmount(it)}
                      </span>
                    </li>
                  ))}
                </ul>

                <p
                  className={`mt-3 text-[14px] font-semibold tabular-nums ${
                    merma < 0 ? "text-danger" : "text-foreground"
                  }`}
                >
                  Merma: {formatQty(merma)} kg ({mermaPct.toFixed(1)}%)
                </p>
                <p className="mt-1 text-[13px] text-secondary-foreground">
                  {personBy.get(s.created_by as string) ?? "—"} ·{" "}
                  {format(new Date(s.created_at as string), "dd/MM/yyyy HH:mm")}
                </p>
                {s.notes && (
                  <p className="mt-2 rounded-2xl bg-secondary px-4 py-2.5 text-[14px] text-foreground">
                    {s.notes as string}
                  </p>
                )}

                <div className="mt-4">
                  <SubDesposteReview
                    subId={s.id as string}
                    summary={`sale ${formatQty(inKg)} kg de ${pname(
                      s.source_product_id as string,
                    )}, entran ${items.length} ${
                      items.length === 1 ? "producto" : "productos"
                    }`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Historial
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {history.map((s, i) => {
              const meta =
                STATUS_META[s.status as string] ?? STATUS_META.rejected;
              return (
                <li
                  key={s.id as string}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {pname(s.source_product_id as string)}
                    </p>
                    <p className="text-[13px] text-secondary-foreground tabular-nums">
                      {formatQty(Number(s.source_kg))} kg ·{" "}
                      {s.reviewed_at
                        ? format(new Date(s.reviewed_at as string), "dd/MM/yyyy")
                        : format(new Date(s.created_at as string), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}
