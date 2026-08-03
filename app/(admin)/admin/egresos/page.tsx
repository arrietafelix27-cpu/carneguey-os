import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";
import {
  OUTFLOW_LABELS,
  SUBCATEGORY_LABELS,
  type OutflowCategory,
} from "@/lib/validations/cash-outflow";
import { getReceiptSignedUrls } from "@/lib/receipts";
import { OutflowReview } from "@/components/admin/outflow-review";
import { ReceiptViewer } from "@/components/admin/receipt-viewer";

export const metadata = { title: "Egresos" };
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
      "id, amount, category, subcategory, recipient, notes, status, created_at, created_by, approved_at",
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

  // Nombre del empleado (para préstamos) por cash_outflow_id.
  const pendingIds = pending.map((o) => o.id as string);
  const { data: loans } =
    pendingIds.length > 0
      ? await supabase
          .from("employee_loans")
          .select("cash_outflow_id, employee_id")
          .in("cash_outflow_id", pendingIds)
      : { data: [] as { cash_outflow_id: string; employee_id: string }[] };

  const loanEmployeeIds = Array.from(
    new Set((loans ?? []).map((l) => l.employee_id as string)),
  );
  const { data: loanEmployees } =
    loanEmployeeIds.length > 0
      ? await supabase
          .from("employees")
          .select("id, name")
          .in("id", loanEmployeeIds)
      : { data: [] as { id: string; name: string }[] };
  const empNameById = new Map(
    (loanEmployees ?? []).map((e) => [e.id as string, e.name as string]),
  );

  const loanEmployeeBy = new Map<string, string>();
  for (const l of loans ?? []) {
    loanEmployeeBy.set(
      l.cash_outflow_id as string,
      empNameById.get(l.employee_id as string) ?? "Empleado",
    );
  }

  // Foto (URL firmada) de cada egreso pendiente.
  const photoBy = new Map<string, string[]>();
  await Promise.all(
    pending.map(async (o) => {
      const urls = await getReceiptSignedUrls(
        supabase,
        "cash_outflow",
        o.id as string,
      );
      photoBy.set(o.id as string, urls);
    }),
  );

  const catLabel = (o: { category: string; subcategory: string | null }) =>
    o.category === "expense" && o.subcategory
      ? `Gasto: ${SUBCATEGORY_LABELS[o.subcategory as keyof typeof SUBCATEGORY_LABELS]}`
      : OUTFLOW_LABELS[o.category as OutflowCategory];

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
            const cat = catLabel(
              o as { category: string; subcategory: string | null },
            );
            const employeeName =
              o.category === "employee_advance"
                ? loanEmployeeBy.get(o.id as string)
                : null;
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
                    {employeeName && (
                      <p className="text-[14px] font-medium text-primary">
                        Empleado: {employeeName}
                      </p>
                    )}
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
                <div className="mt-3">
                  <ReceiptViewer urls={photoBy.get(o.id as string) ?? []} />
                </div>
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
