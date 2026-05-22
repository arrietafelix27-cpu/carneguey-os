import Link from "next/link";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getMermaThresholds, thresholdFor } from "@/lib/analytics";
import { formatKg } from "@/lib/format";
import { MermaThresholdEditor } from "@/components/admin/merma-threshold-editor";

export const metadata = { title: "Merma de desposte · Carnegüey OS" };

export default async function MermaPage() {
  const supabase = await createClient();
  const thresholds = await getMermaThresholds(supabase);

  const [{ data: despostes }, { data: lots }] = await Promise.all([
    supabase
      .from("v_desposte_summary")
      .select(
        "desposte_id, lot_id, desposte_date, input_weight_kg, total_output_kg, merma_kg, merma_pct, status",
      )
      .eq("status", "finalized"),
    supabase.from("v_lot_summary").select("lot_id, lot_code, type"),
  ]);

  const lotById = new Map(
    (lots ?? []).map((l) => [l.lot_id as string, l]),
  );

  const rows = (despostes ?? [])
    .map((d) => {
      const lot = lotById.get(d.lot_id as string);
      const type = (lot?.type as string) ?? "beef_carcass";
      const pct = Number(d.merma_pct ?? 0);
      const threshold = thresholdFor(type, thresholds);
      return {
        id: d.desposte_id as string,
        lotCode: (lot?.lot_code as string) ?? "Lote",
        date: d.desposte_date as string,
        input: Number(d.input_weight_kg ?? 0),
        output: Number(d.total_output_kg ?? 0),
        mermaKg: Number(d.merma_kg ?? 0),
        pct,
        high: pct > threshold,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const avgMerma =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.pct, 0) / rows.length
      : 0;
  const anomalies = rows.filter((r) => r.high).length;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin/analitica"
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Analítica
      </Link>

      <h1 className="mb-1 text-3xl font-bold tracking-tight text-foreground">
        Merma de desposte
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Cuánto peso se pierde al convertir la canal en cortes.
      </p>

      {/* Promedio del negocio + umbrales */}
      <div className="mb-6 rounded-3xl bg-card px-6 py-5">
        <p className="text-sm text-muted-foreground">
          Merma promedio del negocio
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-foreground tabular-nums">
          {avgMerma.toFixed(1)}%
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
          <p className="text-xs text-muted-foreground">
            Umbral: res {thresholds.beef}% · cerdo {thresholds.pork}%
          </p>
          <MermaThresholdEditor beef={thresholds.beef} pork={thresholds.pork} />
        </div>
      </div>

      {anomalies > 0 && (
        <div className="mb-5 flex gap-3 rounded-2xl bg-danger/10 px-4 py-3">
          <TriangleAlert className="size-5 shrink-0 text-danger" />
          <p className="text-sm text-foreground">
            {anomalies}{" "}
            {anomalies === 1
              ? "desposte tiene merma anormal"
              : "despostes tienen merma anormal"}
            . Aparecen marcados en rojo.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-secondary px-6 py-16 text-center text-sm text-muted-foreground">
          Aún no hay despostes finalizados.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`rounded-2xl px-5 py-4 ${
                r.high ? "bg-danger/10" : "bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">
                    {r.lotCode}
                    {r.high && (
                      <span className="ml-2 align-middle text-xs font-medium text-danger">
                        merma alta
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(r.date), "dd/MM/yyyy")}
                  </p>
                </div>
                <p
                  className={`text-3xl font-bold tabular-nums ${
                    r.high ? "text-danger" : "text-success"
                  }`}
                >
                  {r.pct.toFixed(1)}%
                </p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                Entró {formatKg(r.input)} kg · salieron {formatKg(r.output)} kg
                · merma {formatKg(r.mermaKg)} kg
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
