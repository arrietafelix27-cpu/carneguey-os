import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatKg, formatCOP } from "@/lib/format";
import { getReceiptSignedUrls } from "@/lib/receipts";
import { ReceiptViewer } from "@/components/admin/receipt-viewer";

export const metadata = { title: "Lote · Carnegüey OS" };

const TYPE_LABEL: Record<string, string> = {
  beef_live: "Res (ganado en pie)",
  beef_carcass: "Res en canal",
  pork_carcass: "Cerdo en canal",
  poultry_carcass: "Pollo en canal",
};

const STATUS_LABEL: Record<string, string> = {
  pending_arrival: "Pendiente de llegada",
  active: "Activo",
  closed: "Cerrado",
};

export default async function LoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lot } = await supabase
    .from("v_lot_summary")
    .select(
      "lot_id, lot_code, type, status, provider_id, carcass_count, carcass_weight_kg, total_cost, cost_per_kg_carcass, kg_despostado, kg_remaining, finalized_desposte_count, created_at",
    )
    .eq("lot_id", id)
    .single();

  if (!lot) redirect("/admin/inventario");

  const [
    { data: provider },
    { data: despostes },
    { data: prevLots },
    receiptUrls,
  ] = await Promise.all([
    supabase.from("providers").select("name").eq("id", lot.provider_id).single(),
    supabase
      .from("v_desposte_summary")
      .select(
        "desposte_id, desposte_date, status, input_weight_kg, total_output_kg, merma_kg, merma_pct",
      )
      .eq("lot_id", id),
    supabase
      .from("v_lot_summary")
      .select("lot_code, carcass_count, carcass_weight_kg, created_at")
      .eq("provider_id", lot.provider_id)
      .eq("type", lot.type)
      .in("status", ["active", "closed"])
      .lt("created_at", lot.created_at)
      .order("created_at", { ascending: false })
      .limit(1),
    getReceiptSignedUrls(supabase, "purchase_lot", id),
  ]);

  const finalized = (despostes ?? []).filter((d) => d.status === "finalized");
  const finalizedIds = finalized.map((d) => d.desposte_id as string);

  // Cortes que salieron del lote
  const cutsMap = new Map<string, number>();
  if (finalizedIds.length > 0) {
    const { data: items } = await supabase
      .from("desposte_items")
      .select("weight_kg, products(name)")
      .in("desposte_id", finalizedIds);
    for (const it of items ?? []) {
      const prod = it.products as unknown as { name: string } | null;
      const name = prod?.name ?? "Producto";
      cutsMap.set(name, (cutsMap.get(name) ?? 0) + Number(it.weight_kg));
    }
  }

  const count = Number(lot.carcass_count ?? 0);
  const carcassWeight = Number(lot.carcass_weight_kg ?? 0);
  const avgPerAnimal = count > 0 ? carcassWeight / count : 0;
  const totalDespostado = Number(lot.kg_despostado ?? 0);
  const totalOutput = [...cutsMap.values()].reduce((s, v) => s + v, 0);
  const totalMerma = finalized.reduce(
    (s, d) => s + Number(d.merma_kg ?? 0),
    0,
  );
  const mermaPctTotal =
    totalDespostado > 0 ? (totalMerma / totalDespostado) * 100 : 0;

  const cuts = [...cutsMap.entries()]
    .map(([name, kg]) => ({
      name,
      kg,
      perAnimal: count > 0 ? kg / count : 0,
      pct: totalOutput > 0 ? (kg / totalOutput) * 100 : 0,
    }))
    .sort((a, b) => b.kg - a.kg);

  // Comparativo con el lote anterior del mismo proveedor
  const prev = prevLots?.[0];
  let comparison: { code: string; better: boolean; diff: number } | null =
    null;
  if (prev) {
    const prevCount = Number(prev.carcass_count ?? 0);
    const prevAvg =
      prevCount > 0 ? Number(prev.carcass_weight_kg ?? 0) / prevCount : 0;
    if (prevAvg > 0) {
      comparison = {
        code: prev.lot_code as string,
        better: avgPerAnimal >= prevAvg,
        diff: Math.abs(avgPerAnimal - prevAvg),
      };
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin/analitica/lotes"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Lotes
      </Link>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        {TYPE_LABEL[lot.type as string] ?? "Lote"} ·{" "}
        {STATUS_LABEL[lot.status as string] ?? lot.status}
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {lot.lot_code}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {provider?.name ?? "Proveedor"}
      </p>

      {/* Promedios del lote */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Big label={lot.type === "pork_carcass" ? "Cerdos" : "Reses"} value={String(count)} />
        <Big label="Kg promedio c/u" value={formatKg(avgPerAnimal)} />
      </div>
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Small label="Peso canal" value={`${formatKg(carcassWeight)} kg`} />
        <Small label="Despostado" value={`${formatKg(totalDespostado)} kg`} />
        <Small label="Sin despostar" value={`${formatKg(Number(lot.kg_remaining ?? 0))} kg`} />
      </div>
      <p className="mb-6 px-1 text-xs text-muted-foreground">
        Costo total {formatCOP(Number(lot.total_cost ?? 0))} ·{" "}
        {formatCOP(Number(lot.cost_per_kg_carcass ?? 0))}/kg
      </p>

      {/* Comprobante */}
      <div className="mb-6">
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Comprobante
        </h2>
        <ReceiptViewer urls={receiptUrls} />
      </div>

      {/* Comparativo con lote anterior */}
      {comparison && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-card shadow-sm px-5 py-4">
          {comparison.better ? (
            <TrendingUp className="size-5 shrink-0 text-success" />
          ) : (
            <TrendingDown className="size-5 shrink-0 text-danger" />
          )}
          <p className="text-sm text-foreground">
            Este lote rindió{" "}
            <span className="font-semibold">
              {comparison.better ? "mejor" : "peor"}
            </span>{" "}
            que el anterior ({comparison.code}): {formatKg(comparison.diff)} kg
            por animal de diferencia.
          </p>
        </div>
      )}

      {/* Merma acumulada */}
      <div className="mb-6 rounded-3xl bg-card shadow-sm px-6 py-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Merma acumulada del lote
        </p>
        <p className="mt-1 text-3xl font-bold text-foreground tabular-nums">
          {formatKg(totalMerma)} kg
        </p>
        <p className="text-xs text-muted-foreground">
          {mermaPctTotal.toFixed(1)}% de lo despostado
        </p>
      </div>

      {/* Cortes que salieron */}
      {cuts.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Cortes que salieron
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {cuts.map((c, i) => (
              <li
                key={c.name}
                className={`px-5 py-3.5 ${
                  i > 0 ? "border-t border-border/60" : ""
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-[15px] font-medium text-foreground">
                    {c.name}
                  </p>
                  <p className="font-semibold text-foreground tabular-nums">
                    {formatKg(c.kg)} kg
                  </p>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, c.pct)}%` }}
                    />
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {c.pct.toFixed(0)}% · {formatKg(c.perAnimal)} kg c/u
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Despostes */}
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Despostes de este lote
      </h2>
      {finalized.length === 0 ? (
        <div className="rounded-3xl bg-card shadow-sm px-6 py-10 text-center text-sm text-muted-foreground">
          Este lote aún no tiene despostes finalizados.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {finalized
            .sort((a, b) =>
              (a.desposte_date as string) < (b.desposte_date as string)
                ? -1
                : 1,
            )
            .map((d, i) => (
              <li
                key={d.desposte_id as string}
                className={`px-5 py-3.5 ${
                  i > 0 ? "border-t border-border/60" : ""
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <p className="font-medium text-foreground">
                    {format(new Date(d.desposte_date as string), "dd/MM/yyyy")}
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    Merma {formatKg(Number(d.merma_kg ?? 0))} kg
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  Entró {formatKg(Number(d.input_weight_kg))} kg · salieron{" "}
                  {formatKg(Number(d.total_output_kg ?? 0))} kg ·{" "}
                  {Number(d.merma_pct ?? 0).toFixed(1)}%
                </p>
              </li>
            ))}
        </ul>
      )}
    </main>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card shadow-sm px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-3xl font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}

function Small({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card shadow-sm px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
