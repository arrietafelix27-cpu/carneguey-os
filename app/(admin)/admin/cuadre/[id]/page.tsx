import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, CheckCircle2, TriangleAlert } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";
import {
  OUTFLOW_LABELS,
  SUBCATEGORY_LABELS,
  type OutflowCategory,
} from "@/lib/validations/cash-outflow";

export const metadata = { title: "Cuadre del día" };
export const dynamic = "force-dynamic";

const TOLERANCE = 2000;

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "A crédito",
};

const OUTFLOW_STATUS: Record<string, { label: string; cls: string }> = {
  approved: { label: "Aprobado", cls: "bg-success/15 text-success" },
  pending: { label: "Pendiente", cls: "bg-warning/15 text-warning" },
  rejected: {
    label: "Rechazado",
    cls: "bg-[var(--bg-muted)] text-secondary-foreground",
  },
};

export default async function CuadreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: closing } = await supabase
    .from("daily_closings")
    .select(
      "id, closing_date, status, expected_cash, counted_cash, difference, notes, closed_at, created_by",
    )
    .eq("id", id)
    .single();

  if (!closing) redirect("/admin/cuadre");

  const day = closing.closing_date as string;
  const dayStart = `${day}T00:00:00-05:00`;
  const dayEnd = `${day}T23:59:59.999-05:00`;

  const [
    { data: items },
    { data: prof },
    { data: sales },
    { data: payments },
    { data: outflows },
    { data: supplierPayments },
  ] = await Promise.all([
    supabase
      .from("daily_closing_items")
      .select("category, amount")
      .eq("daily_closing_id", id),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", closing.created_by)
      .single(),
    supabase
      .from("sales")
      .select("id, created_at, payment_method, total, status, customer_id")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase
      .from("credit_payments")
      .select("id, created_at, amount, payment_method, customer_id")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: true }),
    supabase
      .from("cash_outflows")
      .select("id, created_at, amount, category, subcategory, recipient, status")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: true }),
    supabase
      .from("supplier_payments")
      .select("id, created_at, amount, supplier_invoice_id")
      .eq("payment_source", "cash")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd),
  ]);

  // Pagos a proveedores del día, agrupados por proveedor (solo admin ve esto).
  const spInvoiceIds = Array.from(
    new Set((supplierPayments ?? []).map((p) => p.supplier_invoice_id as string)),
  );
  const { data: spInvoices } =
    spInvoiceIds.length > 0
      ? await supabase
          .from("supplier_invoices")
          .select("id, provider_id")
          .in("id", spInvoiceIds)
      : { data: [] as { id: string; provider_id: string }[] };
  const providerIdByInvoice = new Map(
    (spInvoices ?? []).map((i) => [i.id as string, i.provider_id as string]),
  );

  const spProviderIds = Array.from(
    new Set((spInvoices ?? []).map((i) => i.provider_id as string)),
  );
  const { data: spProviders } =
    spProviderIds.length > 0
      ? await supabase.from("providers").select("id, name").in("id", spProviderIds)
      : { data: [] as { id: string; name: string }[] };
  const providerNameById = new Map(
    (spProviders ?? []).map((p) => [p.id as string, p.name as string]),
  );

  const supplierTotalsByProvider = new Map<string, number>();
  for (const p of supplierPayments ?? []) {
    const providerId = providerIdByInvoice.get(p.supplier_invoice_id as string);
    const name = providerId
      ? (providerNameById.get(providerId) ?? "Proveedor")
      : "Proveedor";
    supplierTotalsByProvider.set(
      name,
      (supplierTotalsByProvider.get(name) ?? 0) + Number(p.amount),
    );
  }
  const supplierRows = Array.from(supplierTotalsByProvider.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const amountOf = (cat: string) =>
    Number((items ?? []).find((i) => i.category === cat)?.amount ?? 0);

  // Nombres de clientes para abonos y ventas a crédito.
  const customerIds = Array.from(
    new Set(
      [
        ...(payments ?? []).map((p) => p.customer_id as string),
        ...(sales ?? []).map((s) => s.customer_id as string | null),
      ].filter((x): x is string => !!x),
    ),
  );
  const { data: customers } =
    customerIds.length > 0
      ? await supabase.from("customers").select("id, name").in("id", customerIds)
      : { data: [] as { id: string; name: string }[] };
  const customerBy = new Map(
    (customers ?? []).map((c) => [c.id as string, c.name as string]),
  );

  const diff = Number(closing.difference ?? 0);
  const ok = Math.abs(diff) <= TOLERANCE;

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/admin/cuadre"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Cuadre de caja
      </Link>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Cuadre del día
      </p>
      <h1 className="text-[28px] font-bold tracking-tight text-foreground">
        {format(new Date(`${day}T12:00:00`), "dd/MM/yyyy")}
      </h1>
      <p className="mb-6 mt-1 text-[13px] text-secondary-foreground">
        Cerrado por {prof?.full_name ?? "—"}
        {closing.closed_at
          ? ` · ${format(new Date(closing.closed_at as string), "HH:mm")}`
          : ""}
      </p>

      {/* Esperado vs contado */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Box label="Efectivo esperado" value={formatCOP(Number(closing.expected_cash ?? 0))} />
        <Box label="Efectivo contado" value={formatCOP(Number(closing.counted_cash ?? 0))} />
      </div>
      <div
        className={`mb-7 flex items-center gap-3 rounded-3xl px-6 py-5 ${
          ok ? "bg-success/10" : "bg-danger/10"
        }`}
      >
        {ok ? (
          <CheckCircle2 className="size-6 shrink-0 text-success" />
        ) : (
          <TriangleAlert className="size-6 shrink-0 text-danger" />
        )}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Diferencia
          </p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              ok ? "text-success" : "text-danger"
            }`}
          >
            {formatCOP(diff)}
          </p>
          <p className="text-xs text-secondary-foreground">
            {ok
              ? `Dentro de la tolerancia (±${formatCOP(TOLERANCE)})`
              : diff > 0
                ? "Sobra efectivo en caja"
                : "Falta efectivo en caja"}
          </p>
        </div>
      </div>

      {/* Resumen por categoría */}
      <Section title="Ventas del día">
        <Row label="Efectivo" value={amountOf("sales_cash")} strong />
        <Row label="Tarjeta" value={amountOf("sales_card")} />
        <Row label="Transferencia" value={amountOf("sales_transfer")} />
        <Row label="A crédito" value={amountOf("credit_sales")} muted />
      </Section>

      <Section title="Abonos de clientes">
        <Row label="Efectivo" value={amountOf("customer_payments_cash")} strong />
        <Row label="Tarjeta" value={amountOf("customer_payments_card")} />
        <Row
          label="Transferencia"
          value={amountOf("customer_payments_transfer")}
        />
      </Section>

      <Section title="Egresos de efectivo">
        <Row
          label="Egresos aprobados"
          value={amountOf("cash_outflows_approved")}
          negative
          strong
        />
        <Row
          label="Egresos pendientes (no restan)"
          value={amountOf("cash_outflows_pending")}
          warn={amountOf("cash_outflows_pending") > 0}
        />
      </Section>

      <Section title="Pagos a proveedores">
        <Row
          label="Pagado de caja"
          value={amountOf("supplier_payments_cash")}
          negative
          strong
        />
      </Section>

      <Section title="Devoluciones">
        <Row
          label="Devuelto en efectivo"
          value={amountOf("sale_returns_cash")}
          negative
          strong
        />
      </Section>

      {closing.notes && (
        <div className="mb-6 rounded-2xl bg-card px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Notas de la cajera
          </p>
          <p className="mt-1 text-[15px] text-foreground">
            {closing.notes as string}
          </p>
        </div>
      )}

      {/* Detalle: abonos */}
      {(payments ?? []).length > 0 && (
        <>
          <h2 className="mb-2.5 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Abonos del día ({(payments ?? []).length})
          </h2>
          <ul className="mb-2 overflow-hidden rounded-3xl bg-card shadow-sm">
            {(payments ?? []).map((p, i) => (
              <li
                key={p.id as string}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-foreground">
                    {customerBy.get(p.customer_id as string) ?? "Cliente"}
                  </p>
                  <p className="text-[13px] text-secondary-foreground">
                    {METHOD_LABEL[p.payment_method as string]} ·{" "}
                    {format(new Date(p.created_at as string), "HH:mm")}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-success tabular-nums">
                  {formatCOP(Number(p.amount ?? 0))}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Detalle: egresos */}
      {(outflows ?? []).length > 0 && (
        <>
          <h2 className="mb-2.5 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Egresos del día ({(outflows ?? []).length})
          </h2>
          <ul className="mb-2 overflow-hidden rounded-3xl bg-card shadow-sm">
            {(outflows ?? []).map((o, i) => {
              const st = OUTFLOW_STATUS[o.status as string] ?? OUTFLOW_STATUS.rejected;
              return (
                <li
                  key={o.id as string}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {o.category === "expense" && o.subcategory
                        ? `Gasto: ${SUBCATEGORY_LABELS[o.subcategory as keyof typeof SUBCATEGORY_LABELS]}`
                        : OUTFLOW_LABELS[o.category as OutflowCategory]}
                    </p>
                    <p className="truncate text-[13px] text-secondary-foreground">
                      {o.recipient ? `${o.recipient} · ` : ""}
                      {format(new Date(o.created_at as string), "HH:mm")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${st.cls}`}
                  >
                    {st.label}
                  </span>
                  <p className="shrink-0 font-semibold text-foreground tabular-nums">
                    {formatCOP(Number(o.amount ?? 0))}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Detalle: pagos a proveedores, agrupados por proveedor */}
      {supplierRows.length > 0 && (
        <>
          <h2 className="mb-2.5 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Pagos a proveedores ({supplierRows.length})
          </h2>
          <ul className="mb-2 overflow-hidden rounded-3xl bg-card shadow-sm">
            {supplierRows.map((r, i) => (
              <li
                key={r.name}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
                  {r.name}
                </p>
                <p className="shrink-0 font-semibold text-foreground tabular-nums">
                  {formatCOP(r.total)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Detalle: ventas */}
      {(sales ?? []).length > 0 && (
        <>
          <h2 className="mb-2.5 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Ventas del día ({(sales ?? []).length})
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {(sales ?? []).map((s, i) => (
              <li
                key={s.id as string}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-foreground">
                    {METHOD_LABEL[s.payment_method as string]}
                    {s.customer_id
                      ? ` · ${customerBy.get(s.customer_id as string) ?? "Cliente"}`
                      : ""}
                  </p>
                  <p className="text-[13px] text-secondary-foreground">
                    {format(new Date(s.created_at as string), "HH:mm")} ·{" "}
                    <span className="font-mono">
                      #{(s.id as string).slice(0, 8)}
                    </span>
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-foreground tabular-nums">
                  {formatCOP(Number(s.total ?? 0))}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3 rounded-3xl bg-card p-5 shadow-sm">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  negative,
  warn,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  negative?: boolean;
  warn?: boolean;
}) {
  const amountCls = warn
    ? "text-[14px] font-semibold text-warning"
    : strong
      ? "text-[16px] font-semibold text-foreground"
      : muted
        ? "text-[14px] text-text-tertiary"
        : "text-[14px] text-foreground";

  return (
    <div className="flex items-center justify-between py-1">
      <span
        className={`text-[14px] ${
          muted ? "text-text-tertiary" : "text-secondary-foreground"
        }`}
      >
        {label}
      </span>
      <span className={`tabular-nums ${amountCls}`}>
        {negative && value > 0 ? "−" : ""}
        {formatCOP(Math.abs(value))}
        {warn ? " ⚠️" : ""}
      </span>
    </div>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        {label}
      </p>
      <p className="mt-0.5 text-[19px] font-bold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
