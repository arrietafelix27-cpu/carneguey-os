import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";
import {
  OUTFLOW_LABELS,
  type OutflowCategory,
} from "@/lib/validations/cash-outflow";
import { OutflowReview } from "@/components/admin/outflow-review";

export const metadata = { title: "Egresos · Carnegüey OS" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; bg: string; text: string }> =
  {
    approved: { label: "Aprobado", bg: "bg-success/15", text: "text-success" },
    rejected: {
      label: "Rechazado",
      bg: "bg-[var(--bg-muted)]",
      text: "text-secondary-foreground",
    },
  };

export default async function EgresosAdminPage() {
  const supabase = await createClient();

  const { data: outflows } = await supabase
    .from("cash_outflows")
    .select(
      "id, amount, category, recipient, notes, status, created_at, created_by, approved_at",
    )
    .order("created_at", { ascending: false })
    .limit(120);

  const all = outflows ?? [];
  const personIds = Array.from(new Set(all.map((o) => o.created_by as string)));
  const { data: profiles } =
    personIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", personIds)
      : { data: [] as { id: string; full_name: string }[] };

  const personBy = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const pending = all.filter((o) => o.status === "pending");
  const history = all.filter((o) => o.status !== "pending");

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
        Egresos de efectivo
      </h1>
      <p className="mb-7 mt-1 text-[15px] text-secondary-foreground">
        Salidas de dinero de la caja. Solo los aprobados descuentan del efectivo
        esperado.
      </p>

      <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Pendientes de aprobación ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
          No hay egresos pendientes.
        </div>
      ) : (
        <ul className="grid gap-3">
          {pending.map((o) => {
            const cat = OUTFLOW_LABELS[o.category as OutflowCategory];
            return (
              <li
                key={o.id as string}
                className="rounded-3xl bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold text-foreground">
                      {cat}
                    </p>
                    <p className="text-[13px] text-secondary-foreground">
                      {o.recipient ? `Para ${o.recipient} · ` : ""}
                      {personBy.get(o.created_by as string) ?? "—"} ·{" "}
                      {format(
                        new Date(o.created_at as string),
                        "dd/MM/yyyy HH:mm",
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 text-[19px] font-bold text-foreground tabular-nums">
                    {formatCOP(Number(o.amount))}
                  </p>
                </div>
                {o.notes && (
                  <p className="mt-2 rounded-2xl bg-secondary px-4 py-2.5 text-[14px] text-foreground">
                    {o.notes as string}
                  </p>
                )}
                <div className="mt-4">
                  <OutflowReview
                    outflowId={o.id as string}
                    summary={`${cat} por ${formatCOP(Number(o.amount))}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Historial
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {history.map((o, i) => {
              const meta =
                STATUS_META[o.status as string] ?? STATUS_META.rejected;
              return (
                <li
                  key={o.id as string}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {OUTFLOW_LABELS[o.category as OutflowCategory]}
                    </p>
                    <p className="truncate text-[13px] text-secondary-foreground">
                      {o.recipient ? `${o.recipient} · ` : ""}
                      {format(new Date(o.created_at as string), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                  <p className="shrink-0 font-semibold text-foreground tabular-nums">
                    {formatCOP(Number(o.amount))}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}
