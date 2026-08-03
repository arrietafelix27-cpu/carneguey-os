import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAllProviders } from "@/lib/cache";
import { formatKg } from "@/lib/format";
import { CloseLotButton } from "@/components/admin/close-lot-button";

export const metadata = { title: "Lotes activos" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  beef_live: "Res",
  beef_carcass: "Res en canal",
  pork_carcass: "Cerdo en canal",
};

export default async function LotesActivosPage() {
  const supabase = await createClient();

  const [{ data: lots }, providers] = await Promise.all([
    supabase
      .from("v_lot_summary")
      .select(
        "lot_id, lot_code, type, provider_id, carcass_weight_kg, kg_despostado, kg_remaining",
      )
      .eq("status", "active"),
    getAllProviders(),
  ]);

  const providerName = new Map(providers.map((p) => [p.id, p.name]));

  const rows = (lots ?? [])
    .map((l) => {
      const original = Number(l.carcass_weight_kg ?? 0);
      const despostado = Number(l.kg_despostado ?? 0);
      const remaining = Math.round(Number(l.kg_remaining ?? 0) * 100) / 100;
      const pctProcessed = original > 0 ? (despostado / original) * 100 : 0;
      const pctRemaining = original > 0 ? (remaining / original) * 100 : 100;
      return {
        lotId: l.lot_id as string,
        lotCode: l.lot_code as string,
        type: l.type as string,
        provider: providerName.get(l.provider_id as string) ?? "Proveedor",
        original,
        despostado,
        remaining,
        pctProcessed,
        ready: pctRemaining < 5,
      };
    })
    .sort((a, b) => b.pctProcessed - a.pctProcessed);

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
        Lotes activos
      </h1>
      <p className="mb-7 mt-1 text-[15px] text-secondary-foreground">
        Lotes con kg pendientes de despostar. Finalízalos cuando ya no quede
        nada físico: el remanente va a merma.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-16 text-center shadow-sm">
          <p className="text-[17px] font-semibold text-foreground">
            No hay lotes activos
          </p>
          <p className="mx-auto mt-1 max-w-xs text-[15px] text-secondary-foreground">
            Todos los lotes están cerrados o pendientes de llegada.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.lotId} className="rounded-3xl bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/admin/lotes/${r.lotId}`}
                    className="inline-flex items-center gap-1 text-[18px] font-bold tracking-tight text-foreground"
                  >
                    {r.lotCode}
                    <ChevronRight className="size-4 text-text-tertiary" />
                  </Link>
                  <p className="text-[13px] text-secondary-foreground">
                    {TYPE_LABEL[r.type] ?? "Lote"} · {r.provider}
                  </p>
                </div>
                {r.ready && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[12px] font-semibold text-success">
                    <CircleCheck className="size-3.5" />
                    Listo
                  </span>
                )}
              </div>

              {/* Barra de progreso */}
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, r.pctProcessed)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[13px] text-secondary-foreground tabular-nums">
                  <span>{r.pctProcessed.toFixed(0)}% procesado</span>
                  <span>
                    Restan {formatKg(r.remaining)} de{" "}
                    {formatKg(r.original)} kg
                  </span>
                </div>
              </div>

              {r.ready && (
                <p className="mt-3 rounded-2xl bg-success/10 px-4 py-2.5 text-[13px] text-foreground">
                  Queda menos del 5% sin despostar. Probablemente ya está listo
                  para finalizar.
                </p>
              )}

              <div className="mt-4">
                <CloseLotButton
                  lotId={r.lotId}
                  lotCode={r.lotCode}
                  remainingKg={formatKg(r.remaining)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
