import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";

export const metadata = { title: "Empleado · Carnegüey OS" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; bg: string; text: string }> =
  {
    pending: { label: "Pendiente", bg: "bg-warning/15", text: "text-warning" },
    approved: { label: "Aprobado", bg: "bg-success/15", text: "text-success" },
    rejected: {
      label: "Rechazado",
      bg: "bg-[var(--bg-muted)]",
      text: "text-secondary-foreground",
    },
  };

export default async function EmpleadoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("id, name, role, phone, salary, active")
    .eq("id", id)
    .single();

  if (!employee) redirect("/admin/empleados");

  const { data: loans } = await supabase
    .from("employee_loans")
    .select("id, amount, status, notes, created_at")
    .eq("employee_id", id)
    .order("created_at", { ascending: false });

  const all = loans ?? [];
  const approved = all.filter((l) => l.status === "approved");
  const pending = all.filter((l) => l.status === "pending");
  // Total descontable = préstamos aprobados.
  const totalDeductible = approved.reduce(
    (s, l) => s + Number(l.amount ?? 0),
    0,
  );
  const totalPending = pending.reduce((s, l) => s + Number(l.amount ?? 0), 0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/admin/empleados"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Empleados
      </Link>

      <h1 className="text-[28px] font-bold tracking-tight text-foreground">
        {employee.name}
      </h1>
      <p className="mb-6 mt-1 text-[15px] text-secondary-foreground">
        {employee.role ?? "Sin cargo"}
        {employee.phone ? ` · ${employee.phone}` : ""}
        {!employee.active ? " · Inactivo" : ""}
      </p>

      <div className="mb-7 grid grid-cols-3 gap-3">
        <Box label="Salario" value={formatCOP(Number(employee.salary ?? 0))} />
        <Box
          label="Descontable"
          value={formatCOP(totalDeductible)}
          danger={totalDeductible > 0}
        />
        <Box label="Pendiente" value={formatCOP(totalPending)} />
      </div>

      <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Préstamos ({all.length})
      </h2>
      {all.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
          Este empleado no tiene préstamos registrados.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {all.map((l, i) => {
            const meta = STATUS_META[l.status as string] ?? STATUS_META.rejected;
            return (
              <li
                key={l.id as string}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-foreground">
                    {format(new Date(l.created_at as string), "dd/MM/yyyy")}
                  </p>
                  {l.notes && (
                    <p className="truncate text-[13px] text-secondary-foreground">
                      {l.notes as string}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${meta.bg} ${meta.text}`}
                >
                  {meta.label}
                </span>
                <p className="shrink-0 font-semibold text-foreground tabular-nums">
                  {formatCOP(Number(l.amount ?? 0))}
                </p>
              </li>
            );
          })}
        </ul>
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
        className={`mt-0.5 text-[18px] font-bold tabular-nums ${
          danger ? "text-danger" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
