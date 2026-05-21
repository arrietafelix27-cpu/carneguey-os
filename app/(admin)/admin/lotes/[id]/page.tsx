import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatKg, formatCOP } from "@/lib/format";

export const metadata = { title: "Lote · Carnegüey OS" };

const TYPE_LABEL: Record<string, string> = {
  beef_live: "Res (ganado en pie)",
  beef_carcass: "Res en canal",
  pork_carcass: "Cerdo en canal",
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
      "lot_id, lot_code, type, status, provider_id, carcass_weight_kg, carcass_count, total_cost, cost_per_kg_carcass, kg_despostado, kg_remaining, finalized_desposte_count",
    )
    .eq("lot_id", id)
    .single();

  if (!lot) redirect("/admin/inventario");

  const [{ data: provider }, { data: despostes }] = await Promise.all([
    supabase
      .from("providers")
      .select("name")
      .eq("id", lot.provider_id)
      .single(),
    supabase
      .from("v_desposte_summary")
      .select(
        "desposte_id, desposte_date, status, input_weight_kg, total_output_kg, merma_kg, merma_pct",
      )
      .eq("lot_id", id)
      .order("desposte_date", { ascending: true }),
  ]);

  const finalized = (despostes ?? []).filter((d) => d.status === "finalized");
  const totalMerma = finalized.reduce(
    (s, d) => s + Number(d.merma_kg ?? 0),
    0,
  );
  const totalDespostado = Number(lot.kg_despostado ?? 0);
  const mermaPctTotal =
    totalDespostado > 0 ? (totalMerma / totalDespostado) * 100 : 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/admin/inventario"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Inventario
      </Link>

      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {TYPE_LABEL[lot.type as string] ?? "Lote"} ·{" "}
        {STATUS_LABEL[lot.status as string] ?? lot.status}
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {lot.lot_code}
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        {provider?.name ?? "Proveedor"}
      </p>

      {/* Resumen del lote */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Peso canal" value={`${formatKg(Number(lot.carcass_weight_kg ?? 0))} kg`} />
        <Stat label="Despostado" value={`${formatKg(totalDespostado)} kg`} />
        <Stat label="Sin despostar" value={`${formatKg(Number(lot.kg_remaining ?? 0))} kg`} />
        <Stat label="Costo total" value={formatCOP(Number(lot.total_cost ?? 0))} />
        <Stat label="Costo por kg" value={formatCOP(Number(lot.cost_per_kg_carcass ?? 0))} />
        <Stat label="Despostes" value={String(lot.finalized_desposte_count ?? 0)} />
      </div>

      {/* Merma acumulada destacada */}
      <div className="mb-6 rounded-xl bg-secondary px-5 py-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Merma acumulada del lote
        </p>
        <p className="text-3xl font-bold text-foreground">
          {formatKg(totalMerma)} kg
        </p>
        <p className="text-xs text-muted-foreground">
          {mermaPctTotal.toFixed(1)}% de lo despostado
        </p>
      </div>

      {/* Despostes del lote */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Despostes de este lote
      </h2>
      {finalized.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Este lote aún no tiene despostes finalizados.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {finalized.map((d) => (
            <li key={d.desposte_id as string} className="px-4 py-3">
              <div className="flex items-baseline justify-between">
                <p className="font-medium text-foreground">
                  {format(
                    new Date(d.desposte_date as string),
                    "dd/MM/yyyy",
                  )}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Merma {formatKg(Number(d.merma_kg ?? 0))} kg
                </p>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
