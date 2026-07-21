import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  TriangleAlert,
  Activity,
  Scissors,
  Boxes,
} from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { thresholdFor } from "@/lib/analytics";
import { getAllProviders, getMermaThresholdsCached } from "@/lib/cache";
import { formatKg } from "@/lib/format";

export const metadata = { title: "Analítica · Carnegüey OS" };

export default async function AnaliticaPage() {
  const supabase = await createClient();
  const thresholds = await getMermaThresholdsCached();

  // Limitar a los últimos 90 días: solo necesitamos métricas de 30 días y
  // del mes actual; pedir todo el histórico desperdicia datos.
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString();

  const [{ data: despostes }, { data: lots }, providers] = await Promise.all([
    supabase
      .from("v_desposte_summary")
      .select("desposte_id, lot_id, input_weight_kg, merma_pct, finalized_at, status")
      .eq("status", "finalized")
      .gte("finalized_at", since90),
    supabase
      .from("v_lot_summary")
      .select("lot_id, lot_code, type, status, provider_id, slaughter_yield_pct"),
    getAllProviders(),
  ]);

  const lotById = new Map(
    (lots ?? []).map((l) => [l.lot_id as string, l]),
  );
  const providerName = new Map(providers.map((p) => [p.id, p.name]));

  const now = Date.now();
  const since30 = now - 30 * 86400000;
  const thisMonth = new Date().toISOString().slice(0, 7);

  // Merma promedio últimos 30 días
  const recent = (despostes ?? []).filter(
    (d) => d.finalized_at && new Date(d.finalized_at).getTime() >= since30,
  );
  const mermaAvg30 =
    recent.length > 0
      ? recent.reduce((s, d) => s + Number(d.merma_pct ?? 0), 0) /
        recent.length
      : 0;

  // Kg procesados este mes
  const kgMes = (despostes ?? [])
    .filter((d) => (d.finalized_at as string)?.slice(0, 7) === thisMonth)
    .reduce((s, d) => s + Number(d.input_weight_kg ?? 0), 0);

  // Lotes activos
  const lotesActivos = (lots ?? []).filter(
    (l) => l.status === "active",
  ).length;

  // Mejor proveedor por rendimiento histórico (lotes de ganado en pie)
  const yieldByProvider = new Map<string, number[]>();
  for (const l of lots ?? []) {
    if (l.type === "beef_live" && l.slaughter_yield_pct != null) {
      const arr = yieldByProvider.get(l.provider_id as string) ?? [];
      arr.push(Number(l.slaughter_yield_pct));
      yieldByProvider.set(l.provider_id as string, arr);
    }
  }
  let bestProvider: { name: string; avg: number } | null = null;
  for (const [pid, arr] of yieldByProvider) {
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    if (!bestProvider || avg > bestProvider.avg) {
      bestProvider = { name: providerName.get(pid) ?? "Proveedor", avg };
    }
  }

  // Último desposte
  const sorted = [...(despostes ?? [])].sort((a, b) =>
    (a.finalized_at as string) < (b.finalized_at as string) ? 1 : -1,
  );
  const last = sorted[0];
  const lastLot = last ? lotById.get(last.lot_id as string) : null;
  const lastThreshold = lastLot
    ? thresholdFor(lastLot.type as string, thresholds)
    : thresholds.beef;
  const lastMerma = last ? Number(last.merma_pct ?? 0) : 0;
  const lastIsHigh = !!last && lastMerma > lastThreshold;

  // Anomalías de los últimos 30 días
  const anomalies = recent
    .map((d) => {
      const lot = lotById.get(d.lot_id as string);
      const th = lot ? thresholdFor(lot.type as string, thresholds) : thresholds.beef;
      return { d, lot, th, pct: Number(d.merma_pct ?? 0) };
    })
    .filter((a) => a.pct > a.th)
    .sort((a, b) => b.pct - a.pct);
  const topAnomaly = anomalies[0];

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="mb-1 text-3xl font-bold tracking-tight text-foreground">
        Analítica
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Cómo rinde la carne, de la compra al corte.
      </p>

      {topAnomaly && (
        <div className="mb-6 flex gap-3 rounded-2xl bg-danger/10 px-4 py-3.5">
          <TriangleAlert className="size-5 shrink-0 text-danger" />
          <p className="text-sm text-foreground">
            El desposte del lote{" "}
            <span className="font-semibold">
              {topAnomaly.lot?.lot_code ?? "—"}
            </span>{" "}
            tuvo {topAnomaly.pct.toFixed(1)}% de merma. Revísalo.
          </p>
        </div>
      )}

      {/* Indicadores */}
      <div className="mb-8 grid grid-cols-2 gap-3">
        <Metric
          label="Merma promedio (30 días)"
          value={`${mermaAvg30.toFixed(1)}%`}
        />
        <Metric
          label="Kg procesados este mes"
          value={`${formatKg(kgMes)} kg`}
        />
        <Metric
          label="Mejor rendimiento"
          value={bestProvider ? `${bestProvider.avg.toFixed(0)}%` : "—"}
          sub={bestProvider?.name ?? "Sin datos"}
        />
        <Metric
          label="Lotes activos"
          value={String(lotesActivos)}
        />
      </div>

      {last && (
        <div className="mb-8">
          <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Último desposte
          </h2>
          <div className="rounded-2xl bg-card shadow-sm px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold text-foreground">
                {lastLot?.lot_code ?? "—"}
              </p>
              <p
                className={`text-xl font-bold tabular-nums ${
                  lastIsHigh ? "text-danger" : "text-success"
                }`}
              >
                {lastMerma.toFixed(1)}%
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {last.finalized_at
                ? format(new Date(last.finalized_at as string), "dd/MM/yyyy")
                : ""}{" "}
              · merma {lastIsHigh ? "alta" : "normal"}
            </p>
          </div>
        </div>
      )}

      {/* Acceso a los 3 niveles */}
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Ver en detalle
      </h2>
      <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
        <LevelLink
          href="/admin/analitica/rendimiento"
          icon={Activity}
          label="Rendimiento de sacrificio"
          desc="Del animal vivo a la canal"
        />
        <LevelLink
          href="/admin/analitica/merma"
          icon={Scissors}
          label="Merma de desposte"
          desc="De la canal al corte"
          border
        />
        <LevelLink
          href="/admin/analitica/lotes"
          icon={Boxes}
          label="Promedios por lote"
          desc="Cuánto rinde cada lote"
          border
        />
      </ul>
    </main>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-card shadow-sm px-4 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="truncate text-xs text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

function LevelLink({
  href,
  icon: Icon,
  label,
  desc,
  border,
}: {
  href: string;
  icon: typeof Activity;
  label: string;
  desc: string;
  border?: boolean;
}) {
  return (
    <li className={border ? "border-t border-border/60" : undefined}>
      <Link
        href={href}
        className="flex items-center gap-4 px-5 py-4 transition-colors active:bg-secondary"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">
            {label}
          </span>
          <span className="block text-[13px] text-muted-foreground">
            {desc}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
      </Link>
    </li>
  );
}
