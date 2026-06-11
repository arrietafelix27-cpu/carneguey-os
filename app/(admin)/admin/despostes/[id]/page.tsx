import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, TriangleAlert, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatKg, formatQty } from "@/lib/format";
import { getMermaThresholds, thresholdFor } from "@/lib/analytics";

export const metadata = { title: "Desposte · Carnegüey OS" };

const TYPE_LABEL: Record<string, string> = {
  beef_live: "Res",
  beef_carcass: "Res en canal",
  pork_carcass: "Cerdo en canal",
  poultry_carcass: "Pollo en canal",
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "En curso",
  finalized: "Finalizado",
};

export default async function DesposteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: desp } = await supabase
    .from("despostes")
    .select(
      "id, lot_id, input_weight_kg, status, desposte_date, finalized_at, created_at, created_by, notes",
    )
    .eq("id", id)
    .single();

  if (!desp) redirect("/admin/entradas");

  const [
    { data: summary },
    { data: lot },
    { data: prof },
    { data: items },
    thresholds,
  ] = await Promise.all([
    supabase
      .from("v_desposte_summary")
      .select("input_weight_kg, total_output_kg, merma_kg, merma_pct")
      .eq("desposte_id", id)
      .maybeSingle(),
    supabase
      .from("v_lot_summary")
      .select("lot_code, type, provider_id")
      .eq("lot_id", desp.lot_id)
      .single(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", desp.created_by)
      .single(),
    supabase
      .from("desposte_items")
      .select("id, weight_kg, unit_count, products(name, unit)")
      .eq("desposte_id", id)
      .order("created_at", { ascending: true }),
    getMermaThresholds(supabase),
  ]);

  const { data: prov } = lot?.provider_id
    ? await supabase
        .from("providers")
        .select("name")
        .eq("id", lot.provider_id)
        .single()
    : { data: null };

  const lotType = (lot?.type as string) ?? "beef_carcass";
  const threshold = thresholdFor(lotType, thresholds);
  const mermaPct = Number(summary?.merma_pct ?? 0);
  const isFinalized = desp.status === "finalized";
  const isHigh = isFinalized && mermaPct > threshold;
  const eventDate = (desp.finalized_at ?? desp.created_at) as string;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin/entradas"
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Últimas entradas
      </Link>

      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Desposte · {STATUS_LABEL[desp.status as string] ?? desp.status}
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {lot?.lot_code ?? "Lote"}
      </h1>
      <p className="mb-1 text-sm text-muted-foreground">
        {TYPE_LABEL[lotType] ?? lotType}
        {prov?.name ? ` · ${prov.name}` : ""}
      </p>
      <p className="mb-6 text-xs text-muted-foreground">
        {format(new Date(eventDate), "dd/MM/yyyy HH:mm")} · {prof?.full_name ?? "—"}
      </p>

      {/* Pesos */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Big
          label="Entró al desposte"
          value={`${formatKg(Number(desp.input_weight_kg))} kg`}
        />
        <Big
          label="Salieron en cortes"
          value={`${formatKg(Number(summary?.total_output_kg ?? 0))} kg`}
        />
      </div>

      {/* Merma */}
      {isFinalized && (
        <div
          className={`mb-6 flex items-center gap-3 rounded-3xl px-6 py-5 ${
            isHigh ? "bg-danger/10" : "bg-success/10"
          }`}
        >
          {isHigh ? (
            <TriangleAlert className="size-6 shrink-0 text-danger" />
          ) : (
            <CheckCircle2 className="size-6 shrink-0 text-success" />
          )}
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Merma {isHigh ? "alta" : "normal"}
            </p>
            <p
              className={`text-2xl font-bold tabular-nums ${
                isHigh ? "text-danger" : "text-success"
              }`}
            >
              {formatKg(Number(summary?.merma_kg ?? 0))} kg ·{" "}
              {mermaPct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              Umbral del tipo: {threshold}%
            </p>
          </div>
        </div>
      )}

      {/* Cortes */}
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Cortes que salieron ({(items ?? []).length})
      </h2>
      {!items || items.length === 0 ? (
        <div className="rounded-3xl bg-secondary px-6 py-10 text-center text-sm text-muted-foreground">
          Sin cortes registrados.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card">
          {items.map((it, i) => {
            const prod = it.products as unknown as {
              name: string;
              unit: string;
            } | null;
            const unit = prod?.unit === "unit" ? "unit" : "kg";
            const weight = Number(it.weight_kg);
            const unitCount = (it as { unit_count?: number | null })
              .unit_count;
            let amount: string;
            if (unit === "unit") {
              if (unitCount !== null && unitCount !== undefined) {
                amount = `${formatQty(Number(unitCount))} u · ${formatKg(weight)} kg`;
              } else {
                amount = `${formatQty(weight)} u`;
              }
            } else {
              amount = `${formatKg(weight)} kg`;
            }
            return (
              <li
                key={it.id as string}
                className={`flex items-center justify-between px-5 py-3.5 ${
                  i > 0 ? "border-t border-border/60" : ""
                }`}
              >
                <span className="font-medium text-foreground">
                  {prod?.name ?? "Producto"}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {amount}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {desp.notes && (
        <div className="mt-6 rounded-2xl bg-card px-5 py-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Notas
          </p>
          <p className="mt-1 text-sm text-foreground">{desp.notes as string}</p>
        </div>
      )}

      <div className="mt-8">
        <Link
          href={`/admin/lotes/${desp.lot_id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          Ver el lote completo
        </Link>
      </div>
    </main>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
