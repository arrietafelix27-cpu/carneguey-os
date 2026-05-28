import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { statusClasses } from "@/lib/analytics";
import { getAllProviders } from "@/lib/cache";
import { formatKg } from "@/lib/format";

export const metadata = { title: "Rendimiento de sacrificio · Carnegüey OS" };

export default async function RendimientoPage() {
  const supabase = await createClient();

  const [{ data: lots }, providers] = await Promise.all([
    supabase
      .from("v_lot_summary")
      .select(
        "lot_id, lot_code, type, status, provider_id, live_weight_kg, carcass_weight_kg, slaughter_yield_pct, arrival_date, created_at",
      )
      .eq("type", "beef_live")
      .in("status", ["active", "closed"]),
    getAllProviders(),
  ]);

  const providerName = new Map(providers.map((p) => [p.id, p.name]));

  const arrived = (lots ?? [])
    .filter((l) => l.slaughter_yield_pct != null)
    .map((l) => ({
      lotId: l.lot_id as string,
      lotCode: l.lot_code as string,
      providerId: l.provider_id as string,
      providerName: providerName.get(l.provider_id as string) ?? "Proveedor",
      live: Number(l.live_weight_kg ?? 0),
      carcass: Number(l.carcass_weight_kg ?? 0),
      yieldPct: Number(l.slaughter_yield_pct),
      createdAt: l.created_at as string,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Promedio histórico por proveedor
  const byProvider = new Map<string, number[]>();
  for (const l of arrived) {
    const arr = byProvider.get(l.providerId) ?? [];
    arr.push(l.yieldPct);
    byProvider.set(l.providerId, arr);
  }
  const providerAvg = new Map<string, number>();
  for (const [pid, arr] of byProvider) {
    providerAvg.set(pid, arr.reduce((s, v) => s + v, 0) / arr.length);
  }
  const providerRows = [...byProvider.entries()]
    .map(([pid, arr]) => ({
      name: providerName.get(pid) ?? "Proveedor",
      avg: providerAvg.get(pid) ?? 0,
      count: arr.length,
    }))
    .sort((a, b) => b.avg - a.avg);

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
        Rendimiento de sacrificio
      </h1>
      <p className="mb-7 text-sm text-muted-foreground">
        Cuánta carne en canal rinde el ganado que compras vivo.
      </p>

      {arrived.length === 0 ? (
        <div className="rounded-3xl bg-secondary px-6 py-16 text-center text-sm text-muted-foreground">
          Aún no hay lotes de ganado en pie con canales recibidas.
        </div>
      ) : (
        <>
          <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Promedio por proveedor
          </h2>
          <ul className="mb-8 overflow-hidden rounded-3xl bg-card">
            {providerRows.map((p, i) => (
              <li
                key={p.name}
                className={`flex items-center justify-between px-5 py-3.5 ${
                  i > 0 ? "border-t border-border/60" : ""
                }`}
              >
                <span className="text-[15px] font-medium text-foreground">
                  {p.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  <span className="text-base font-semibold text-foreground tabular-nums">
                    {p.avg.toFixed(0)}%
                  </span>{" "}
                  · {p.count} {p.count === 1 ? "lote" : "lotes"}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Cada lote
          </h2>
          <ul className="space-y-3">
            {arrived.map((l) => {
              const avg = providerAvg.get(l.providerId) ?? l.yieldPct;
              const status = l.yieldPct >= avg - 0.05 ? "good" : "bad";
              const c = statusClasses(status);
              return (
                <li key={l.lotId}>
                  <Link
                    href={`/admin/lotes/${l.lotId}`}
                    className="block rounded-2xl bg-card px-5 py-4 transition-colors active:bg-secondary"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">
                          {l.lotCode}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {l.providerName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${c.dot}`} />
                        <span
                          className={`text-3xl font-bold tabular-nums ${c.text}`}
                        >
                          {l.yieldPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                      {formatKg(l.live)} kg vivos → {formatKg(l.carcass)} kg
                      canal
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Promedio del proveedor: {avg.toFixed(0)}%</span>
                      <span className="inline-flex items-center gap-0.5">
                        Ver lote <ChevronRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
