import Link from "next/link";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminAlerts } from "@/lib/admin-alerts";
import { getMoneySnapshot } from "@/lib/analytics-money";
import { formatCOP } from "@/lib/format";
import { AdminAlertsPanel } from "@/components/admin/admin-alerts-panel";
import { FirstRunTour } from "@/components/admin/first-run-tour";

export const metadata = { title: "Panel" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const profile = await getCurrentProfile();
  const firstName = profile.full_name.split(" ")[0];
  const supabase = await createClient();

  const [alerts, money] = await Promise.all([
    getAdminAlerts(supabase),
    getMoneySnapshot(supabase),
  ]);

  const { today, todayByMethod, month, monthVsPreviousPct } = money;
  const trend =
    monthVsPreviousPct == null
      ? null
      : monthVsPreviousPct > 1
        ? "up"
        : monthVsPreviousPct < -1
          ? "down"
          : "flat";

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <FirstRunTour />

      <header className="mb-7">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Panel de administración
        </p>
        <h1 className="mt-1 text-[34px] font-bold leading-tight tracking-tight text-foreground">
          Hola, {firstName}
        </h1>
      </header>

      {/* ── Hoy ──────────────────────────────────────────────────────── */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Hoy
        </h2>
        <div className="rounded-3xl bg-card px-5 py-5 shadow-sm">
          <p className="text-[13px] text-muted-foreground">Vendido hoy</p>
          <p className="mt-0.5 text-[34px] font-bold leading-tight tracking-tight tabular-nums text-foreground">
            {formatCOP(today.revenue)}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {today.saleCount}{" "}
            {today.saleCount === 1 ? "venta" : "ventas"}
            {today.saleCount > 0 && (
              <> · promedio {formatCOP(today.averageTicket)}</>
            )}
          </p>

          {today.revenue > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-[13px]">
              <MethodRow label="Efectivo" value={todayByMethod.cash} />
              <MethodRow label="Tarjeta" value={todayByMethod.card} />
              <MethodRow label="Transferencia" value={todayByMethod.transfer} />
              <MethodRow label="Fiado" value={todayByMethod.credit} />
            </dl>
          )}
        </div>
      </section>

      {/* ── Este mes ─────────────────────────────────────────────────── */}
      <section className="mb-7">
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Este mes
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Tile
            label="Vendido"
            value={formatCOP(month.revenue)}
            sub={
              trend && monthVsPreviousPct != null ? (
                <span
                  className={`inline-flex items-center gap-1 ${
                    trend === "up"
                      ? "text-success"
                      : trend === "down"
                        ? "text-danger"
                        : "text-muted-foreground"
                  }`}
                >
                  {trend === "up" ? (
                    <TrendingUp className="size-3.5" />
                  ) : trend === "down" ? (
                    <TrendingDown className="size-3.5" />
                  ) : (
                    <Minus className="size-3.5" />
                  )}
                  {Math.abs(monthVsPreviousPct).toFixed(0)}% vs. mes pasado
                </span>
              ) : (
                "Sin mes anterior para comparar"
              )
            }
          />
          <Tile
            label="Ganancia bruta"
            value={formatCOP(month.profit)}
            sub={`${month.marginPct.toFixed(0)}% de margen`}
          />
        </div>
        <p className="mt-2 px-1 text-[12px] leading-snug text-muted-foreground">
          La ganancia bruta es lo vendido menos lo que te costó esa carne. No
          descuenta gastos, nómina ni servicios.
        </p>
      </section>

      <Link
        href="/admin/analitica/dinero"
        className="mb-8 flex items-center gap-3 rounded-3xl bg-card px-5 py-4 shadow-sm transition-colors active:bg-secondary"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">
            Ver el detalle del dinero
          </span>
          <span className="block text-[13px] text-muted-foreground">
            Qué producto deja más, comparativos y gastos
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
      </Link>

      <AdminAlertsPanel alerts={alerts} />
    </main>
  );
}

function MethodRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">
        {formatCOP(value)}
      </dd>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card px-4 py-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-bold leading-tight tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">{sub}</p>
    </div>
  );
}
