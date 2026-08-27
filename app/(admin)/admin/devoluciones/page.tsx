import Link from "next/link";
import { ChevronLeft, Ban, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatKg, formatQty } from "@/lib/format";
import { SaleAdjustmentReview } from "@/components/admin/sale-adjustment-review";

export const metadata = { title: "Anulaciones y devoluciones" };
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

type AdjustmentRow = {
  id: string;
  sale_id: string;
  kind: "void" | "return";
  status: string;
  reason: string | null;
  refund_method: "cash" | "credit_note" | null;
  restock: boolean;
  total_amount: number;
  requested_by: string;
  requested_at: string;
};

export default async function DevolucionesPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("sale_adjustments")
    .select(
      "id, sale_id, kind, status, reason, refund_method, restock, total_amount, requested_by, requested_at",
    )
    .order("requested_at", { ascending: false })
    .limit(120);

  const all = (rows ?? []) as AdjustmentRow[];

  const personIds = Array.from(new Set(all.map((a) => a.requested_by)));
  const adjustmentIds = all.map((a) => a.id);

  const [{ data: profiles }, { data: items }] = await Promise.all([
    personIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", personIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    adjustmentIds.length > 0
      ? supabase
          .from("sale_adjustment_items")
          .select("adjustment_id, product_id, quantity, total_price")
          .in("adjustment_id", adjustmentIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const productIds = Array.from(
    new Set((items ?? []).map((i) => i.product_id as string)),
  );
  const { data: products } =
    productIds.length > 0
      ? await supabase
          .from("products")
          .select("id, name, unit")
          .in("id", productIds)
      : { data: [] as { id: string; name: string; unit: string }[] };

  const personBy = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string]),
  );
  const productBy = new Map(
    (products ?? []).map((p) => [
      p.id as string,
      { name: p.name as string, unit: p.unit as string },
    ]),
  );

  const itemsBy = new Map<string, string[]>();
  for (const it of items ?? []) {
    const adjId = it.adjustment_id as string;
    const prod = productBy.get(it.product_id as string);
    const qty = Number(it.quantity ?? 0);
    const label = prod
      ? `${prod.name} · ${
          prod.unit === "kg" ? `${formatKg(qty)} kg` : `${formatQty(qty)} und`
        }`
      : "Producto";
    itemsBy.set(adjId, [...(itemsBy.get(adjId) ?? []), label]);
  }

  const pending = all.filter((a) => a.status === "pending");
  const history = all.filter((a) => a.status !== "pending");

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
        Anulaciones y devoluciones
      </h1>
      <p className="mb-7 mt-1 text-[15px] leading-snug text-secondary-foreground">
        Ventas que se corrigieron. Nada se aplica al inventario ni a la caja
        hasta que tú lo apruebes.
      </p>

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Esperando tu aprobación
          </h2>
          <ul className="grid gap-3">
            {pending.map((a) => (
              <li key={a.id} className="rounded-3xl bg-card p-5 shadow-sm">
                <AdjustmentHeader
                  adjustment={a}
                  person={personBy.get(a.requested_by) ?? "—"}
                  itemLabels={itemsBy.get(a.id) ?? []}
                />
                <div className="mt-4">
                  <SaleAdjustmentReview
                    adjustmentId={a.id}
                    summary={summaryOf(a, itemsBy.get(a.id) ?? [])}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Historial
      </h2>
      {history.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
          {pending.length === 0
            ? "No hay anulaciones ni devoluciones."
            : "Todavía no has revisado ninguna."}
        </div>
      ) : (
        <ul className="grid gap-3">
          {history.map((a) => {
            const meta = STATUS_META[a.status];
            return (
              <li key={a.id} className="rounded-3xl bg-card p-5 shadow-sm">
                <AdjustmentHeader
                  adjustment={a}
                  person={personBy.get(a.requested_by) ?? "—"}
                  itemLabels={itemsBy.get(a.id) ?? []}
                />
                {meta && (
                  <span
                    className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function summaryOf(a: AdjustmentRow, itemLabels: string[]): string {
  if (a.kind === "void") {
    return `Se anulará la venta completa por ${formatCOP(a.total_amount)}. Los productos vuelven al inventario.`;
  }
  const destino = a.restock
    ? "vuelve al inventario"
    : "se da por perdido (no vuelve al inventario)";
  const plata =
    a.refund_method === "cash"
      ? "sale de la caja de hoy"
      : "se le baja al cliente de lo que debe";
  return `Devolución de ${itemLabels.join(", ")} por ${formatCOP(a.total_amount)}. El producto ${destino} y la plata ${plata}.`;
}

function AdjustmentHeader({
  adjustment: a,
  person,
  itemLabels,
}: {
  adjustment: AdjustmentRow;
  person: string;
  itemLabels: string[];
}) {
  const isVoid = a.kind === "void";
  const Icon = isVoid ? Ban : Undo2;

  return (
    <>
      <div className="flex items-start gap-3">
        <span
          className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
            isVoid
              ? "bg-danger/10 text-danger"
              : "bg-[var(--brand-red-soft)] text-primary"
          }`}
        >
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-foreground">
            {isVoid ? "Anular venta" : "Devolución"}
          </p>
          <p className="text-[13px] text-secondary-foreground">
            {person} · {format(new Date(a.requested_at), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
        <p className="shrink-0 text-[17px] font-bold tabular-nums text-foreground">
          {formatCOP(a.total_amount)}
        </p>
      </div>

      {!isVoid && itemLabels.length > 0 && (
        <p className="mt-2.5 text-[14px] leading-snug text-foreground">
          {itemLabels.join(" · ")}
        </p>
      )}

      {!isVoid && (
        <p className="mt-1 text-[13px] text-secondary-foreground">
          {a.restock ? "Vuelve al inventario" : "Se da por perdido"} ·{" "}
          {a.refund_method === "cash"
            ? "Se devuelve en efectivo"
            : "Se le baja la deuda"}
        </p>
      )}

      {a.reason && (
        <p className="mt-2 rounded-2xl bg-secondary px-3.5 py-2 text-[13px] leading-snug text-secondary-foreground">
          {a.reason}
        </p>
      )}
    </>
  );
}
