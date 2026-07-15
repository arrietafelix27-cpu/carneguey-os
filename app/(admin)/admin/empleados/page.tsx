import Link from "next/link";
import { ChevronLeft, HandCoins, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  EmployeesManager,
  type EmployeeRow,
} from "@/components/admin/employees-manager";

export const metadata = { title: "Nómina · Carnegüey OS" };
export const dynamic = "force-dynamic";

export default async function EmpleadosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id, name, role, phone, salary, active")
    .order("name", { ascending: true });

  const rows: EmployeeRow[] = (data ?? []).map((e) => ({
    id: e.id as string,
    name: e.name as string,
    role: (e.role as string | null) ?? null,
    phone: (e.phone as string | null) ?? null,
    salary: Number(e.salary ?? 0),
    active: e.active as boolean,
  }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-9">
      <Link
        href="/admin/operaciones"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Operaciones
      </Link>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Nómina
      </p>

      <Link
        href="/admin/nomina/pago"
        className="mb-6 mt-3 flex items-center gap-4 rounded-3xl bg-card p-4 shadow-sm transition-colors active:bg-secondary"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-red-soft)] text-primary">
          <HandCoins className="size-6" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold text-foreground">
            Realizar pago
          </span>
          <span className="block text-[14px] text-secondary-foreground">
            Pagar la quincena y descontar préstamos
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-text-tertiary" />
      </Link>

      <EmployeesManager initialEmployees={rows} />
    </main>
  );
}
