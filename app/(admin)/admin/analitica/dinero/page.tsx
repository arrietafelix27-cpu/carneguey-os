import Link from "next/link";
import { ChevronLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMoneySnapshot } from "@/lib/analytics-money";
import { formatCOP, formatKg } from "@/lib/format";

export const metadata = { title: "Dinero" };
export const dynamic = "force-dynamic";

export default async function DineroPage() {
  const supabase = await createClient();
  const m = await getMoneySnapshot(supabase);

  const best = m.topProducts.slice(0, 8);
  const worst = m.topProducts.filter((p) => p.profit < 0).slice(0, 5);

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
        Dinero
      </h1>
      <p className="mb-7 mt-1 text-[15px] leading-snug text-secondary-foreground">
        Cuánto entra, cuánto te cuesta y qué te deja ganancia de verdad.
      </p>

      {/* Mes actual */}
      <section className="mb-8">
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Este mes
        </h2>
        <div className="overflow-hidden rounded-3xl bg-card shadow-sm">
          <Line label="Vendido" value={formatCOP(m.month.revenue)} strong />
          <Line label="Te costó esa carne" value={`− ${formatCOP(m.month.cost)}`} />
          <Line
            label="Ganancia bruta"
            value={formatCOP(m.month.profit)}
            strong
            accent={m.month.profit >= 0 ? "success" : "danger"}
          />
          <Line
            label="Margen"
            value={`${m.month.marginPct.toFixed(1)}%`}
          />
          <Line
            label="Gastos y salidas aprobados"
            value={`− ${formatCOP(m.outflowsMonth)}`}
          />
          <Line
            label="Queda después de gastos"
            value={formatCOP(m.month.profit - m.outflowsMonth)}
            strong
            accent={
              m.month.profit - m.outflowsMonth >= 0 ? "success" : "danger"
            }
          />
        </div>
        <p className="mt-2 px-1 text-[12px] leading-snug text-muted-foreground">
          Esto todavía no descuenta nómina ni servicios: es la plata que deja la
          carne después de los gastos que registra la caja.
        </p>
      </section>

      {/* Comparación */}
      <section className="mb-8">
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Contra el mes pasado
        </h2>
        <div className="rounded-3xl bg-card px-5 py-4 shadow-sm">
          {m.monthVsPreviousPct == null ? (
            <p className="text-[15px] text-secondary-foreground">
              Todavía no hay un mes anterior con ventas para comparar.
            </p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] text-secondary-foreground">
                  A esta misma altura del mes pasado
                </span>
                <span className="text-[15px] font-semibold tabular-nums text-foreground">
                  {formatCOP(m.previousMonth.revenue)}
                </span>
              </div>
              <p
                className={`mt-2 inline-flex items-center gap-1.5 text-[15px] font-semibold ${
                  m.monthVsPreviousPct > 1
                    ? "text-success"
                    : m.monthVsPreviousPct < -1
                      ? "text-danger"
                      : "text-muted-foreground"
                }`}
              >
                {m.monthVsPreviousPct > 1 ? (
                  <TrendingUp className="size-4" />
                ) : m.monthVsPreviousPct < -1 ? (
                  <TrendingDown className="size-4" />
                ) : (
                  <Minus className="size-4" />
                )}
                {m.monthVsPreviousPct > 0 ? "+" : ""}
                {m.monthVsPreviousPct.toFixed(1)}%
              </p>
            </>
          )}
        </div>
      </section>

      {/* Productos que más dejan */}
      <section className="mb-8">
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Lo que más te deja este mes
        </h2>
        {best.length === 0 ? (
          <div className="rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
            Todavía no hay ventas este mes.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {best.map((p, i) => (
              <li
                key={p.productId}
                className={i > 0 ? "border-t border-border/60" : undefined}
              >
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {p.unit === "unit"
                        ? `${Math.round(p.quantity)} unidades`
                        : `${formatKg(p.quantity)} kg`}{" "}
                      · vendido {formatCOP(p.revenue)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-[15px] font-semibold tabular-nums ${
                        p.profit >= 0 ? "text-foreground" : "text-danger"
                      }`}
                    >
                      {formatCOP(p.profit)}
                    </p>
                    <p className="text-[12px] text-muted-foreground tabular-nums">
                      {p.marginPct.toFixed(0)}%
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Productos que pierden plata */}
      {worst.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Ojo con estos — te están costando más de lo que dejan
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {worst.map((p, i) => (
              <li
                key={p.productId}
                className={i > 0 ? "border-t border-border/60" : undefined}
              >
                <div className="flex items-baseline justify-between gap-3 px-5 py-3.5">
                  <p className="truncate text-[15px] font-medium text-foreground">
                    {p.name}
                  </p>
                  <p className="shrink-0 text-[15px] font-semibold tabular-nums text-danger">
                    {formatCOP(p.profit)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-[12px] leading-snug text-muted-foreground">
            Puede ser precio de venta muy bajo, merma alta en ese corte, o que
            el costo del lote quedó mal registrado.
          </p>
        </section>
      )}
    </main>
  );
}

function Line({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: "success" | "danger";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 px-5 py-3.5 last:border-b-0">
      <span
        className={`text-[15px] ${
          strong ? "font-semibold text-foreground" : "text-secondary-foreground"
        }`}
      >
        {label}
      </span>
      <span
        className={`shrink-0 tabular-nums ${
          strong ? "text-[17px] font-bold" : "text-[15px]"
        } ${
          accent === "success"
            ? "text-success"
            : accent === "danger"
              ? "text-danger"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
