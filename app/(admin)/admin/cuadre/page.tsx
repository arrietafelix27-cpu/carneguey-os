import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";

export const metadata = { title: "Cuadre de caja · Carnegüey OS" };
export const dynamic = "force-dynamic";

const TOLERANCE = 2000;

export default async function CuadreListPage() {
  const supabase = await createClient();

  const { data: closings } = await supabase
    .from("daily_closings")
    .select(
      "id, closing_date, status, expected_cash, counted_cash, difference, closed_at",
    )
    .order("closing_date", { ascending: false })
    .limit(60);

  const list = closings ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/admin/operaciones"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Operaciones
      </Link>

      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Cuadre de caja
      </h1>
      <p className="mb-7 mt-1 text-[15px] text-secondary-foreground">
        Cierre diario: lo que la app esperaba vs. lo que se contó.
      </p>

      {list.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
          Aún no hay días cerrados.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {list.map((c, i) => {
            const diff = Number(c.difference ?? 0);
            const ok = Math.abs(diff) <= TOLERANCE;
            return (
              <li
                key={c.id as string}
                className={i > 0 ? "border-t border-border" : undefined}
              >
                <Link
                  href={`/admin/cuadre/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-foreground">
                      {format(
                        new Date(`${c.closing_date}T12:00:00`),
                        "dd/MM/yyyy",
                      )}
                    </p>
                    <p className="text-[13px] text-secondary-foreground tabular-nums">
                      Esperado {formatCOP(Number(c.expected_cash ?? 0))} ·
                      Contado {formatCOP(Number(c.counted_cash ?? 0))}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums ${
                      ok
                        ? "bg-success/15 text-success"
                        : "bg-danger/15 text-danger"
                    }`}
                  >
                    {ok ? "Cuadra" : formatCOP(diff)}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-text-tertiary" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
