import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";
import { describeDiscount } from "@/components/admin/customers-manager";
import { CreditPaymentForm } from "@/components/admin/credit-payment-form";

export const metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "A crédito",
};

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, name, phone, discount_type, discount_value, credit_limit, active, notes",
    )
    .eq("id", id)
    .single();

  if (!customer) redirect("/admin/clientes");

  const [{ data: balance }, { data: sales }, { data: payments }] =
    await Promise.all([
      supabase
        .from("v_customer_balances")
        .select("credit_total, paid_total, balance")
        .eq("customer_id", id)
        .maybeSingle(),
      supabase
        .from("sales")
        .select("id, created_at, payment_method, total, status")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("credit_payments")
        .select("id, amount, payment_method, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  const bal = Number(balance?.balance ?? 0);
  const creditTotal = Number(balance?.credit_total ?? 0);
  const paidTotal = Number(balance?.paid_total ?? 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-9">
      <Link
        href="/admin/clientes"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Clientes
      </Link>

      <h1 className="text-[28px] font-bold tracking-tight text-foreground">
        {customer.name}
      </h1>
      <p className="mb-6 mt-1 text-[15px] text-secondary-foreground">
        {describeDiscount({
          discount_type: customer.discount_type as never,
          discount_value: Number(customer.discount_value ?? 0),
        })}
        {customer.phone ? ` · ${customer.phone}` : ""}
        {!customer.active ? " · Inactivo" : ""}
      </p>

      {/* Saldo */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Box label="Comprado a crédito" value={formatCOP(creditTotal)} />
        <Box label="Abonado" value={formatCOP(paidTotal)} />
        <Box
          label="Saldo pendiente"
          value={formatCOP(bal)}
          danger={bal > 0}
        />
      </div>
      <div className="mb-2 flex items-center justify-between">
        <p className="px-1 text-[13px] text-secondary-foreground">
          Cupo de crédito: {formatCOP(Number(customer.credit_limit ?? 0))}
        </p>
        <CreditPaymentForm customerId={id} />
      </div>

      {customer.notes && (
        <div className="mb-6 mt-4 rounded-2xl bg-card px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Notas
          </p>
          <p className="mt-1 text-[15px] text-foreground">
            {customer.notes as string}
          </p>
        </div>
      )}

      {/* Historial de compras */}
      <h2 className="mb-2.5 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Historial de compras
      </h2>
      {(sales ?? []).length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
          Este cliente aún no tiene compras.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {(sales ?? []).map((s, i) => {
            const pending = s.status === "credit_pending";
            return (
              <li
                key={s.id as string}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-foreground">
                    {format(
                      new Date(s.created_at as string),
                      "dd/MM/yyyy HH:mm",
                    )}
                  </p>
                  <p className="text-[13px] text-secondary-foreground">
                    {METHOD_LABEL[s.payment_method as string] ??
                      s.payment_method}
                    {" · "}
                    <span className="font-mono">
                      #{(s.id as string).slice(0, 8)}
                    </span>
                  </p>
                </div>
                {pending && (
                  <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-[12px] font-semibold text-warning">
                    Pendiente
                  </span>
                )}
                <p className="shrink-0 font-semibold text-foreground tabular-nums">
                  {formatCOP(Number(s.total ?? 0))}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {/* Abonos */}
      {(payments ?? []).length > 0 && (
        <>
          <h2 className="mb-2.5 mt-8 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Abonos
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {(payments ?? []).map((p, i) => (
              <li
                key={p.id as string}
                className={`flex items-center justify-between px-4 py-3.5 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div>
                  <p className="text-[15px] font-medium text-foreground">
                    {format(
                      new Date(p.created_at as string),
                      "dd/MM/yyyy HH:mm",
                    )}
                  </p>
                  <p className="text-[13px] text-secondary-foreground">
                    {METHOD_LABEL[p.payment_method as string] ??
                      p.payment_method}
                  </p>
                </div>
                <p className="font-semibold text-success tabular-nums">
                  {formatCOP(Number(p.amount ?? 0))}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

function Box({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        {label}
      </p>
      <p
        className={`mt-0.5 text-[19px] font-bold tabular-nums ${
          danger ? "text-danger" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
