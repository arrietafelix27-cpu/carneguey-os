import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { bogotaToday } from "@/lib/dates";
import {
  PayrollPayment,
  type PayEmployee,
  type LoanRow,
} from "@/components/admin/payroll-payment";

export const metadata = { title: "Realizar pago" };
export const dynamic = "force-dynamic";

export default async function PagoNominaPage() {
  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, role, salary")
    .eq("active", true)
    .order("name", { ascending: true });

  const empIds = (employees ?? []).map((e) => e.id as string);

  const { data: loans } =
    empIds.length > 0
      ? await supabase
          .from("employee_loans")
          .select("id, employee_id, amount, created_at")
          .eq("status", "approved")
          .in("employee_id", empIds)
      : { data: [] as { id: string; employee_id: string; amount: number; created_at: string }[] };

  const loanIds = (loans ?? []).map((l) => l.id as string);
  const { data: deductions } =
    loanIds.length > 0
      ? await supabase
          .from("payroll_deductions")
          .select("employee_loan_id, amount")
          .in("employee_loan_id", loanIds)
      : { data: [] as { employee_loan_id: string; amount: number }[] };

  const deductedByLoan = new Map<string, number>();
  for (const d of deductions ?? []) {
    const lid = d.employee_loan_id as string;
    deductedByLoan.set(lid, (deductedByLoan.get(lid) ?? 0) + Number(d.amount ?? 0));
  }

  const loansByEmployee = new Map<string, LoanRow[]>();
  for (const l of loans ?? []) {
    const amount = Number(l.amount ?? 0);
    const remaining =
      Math.round((amount - (deductedByLoan.get(l.id as string) ?? 0)) * 100) /
      100;
    if (remaining <= 0.01) continue;
    const arr = loansByEmployee.get(l.employee_id as string) ?? [];
    arr.push({
      id: l.id as string,
      amount,
      remaining,
      createdAt: format(new Date(l.created_at as string), "dd/MM/yyyy"),
    });
    loansByEmployee.set(l.employee_id as string, arr);
  }

  const list: PayEmployee[] = (employees ?? []).map((e) => ({
    id: e.id as string,
    name: e.name as string,
    role: (e.role as string | null) ?? null,
    salary: Number(e.salary ?? 0),
    loans: loansByEmployee.get(e.id as string) ?? [],
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/admin/empleados"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Nómina
      </Link>

      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Nómina
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Realizar pago
      </h1>

      <PayrollPayment employees={list} today={bogotaToday()} />
    </main>
  );
}
