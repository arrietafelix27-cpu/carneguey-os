import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { OutflowCategory } from "@/lib/validations/cash-outflow";
import {
  GastosForm,
  type Employee,
  type TodayGasto,
} from "@/components/employee/gastos-form";

export const metadata = { title: "Gastos y salidas" };
export const dynamic = "force-dynamic";

export default async function GastosCajeraPage() {
  const supabase = await createClient();

  const [{ data: employees }, { data: outflows }] = await Promise.all([
    supabase.from("v_employees_active").select("id, name").order("name"),
    // La RLS limita a los egresos propios del día actual.
    supabase
      .from("cash_outflows")
      .select("id, amount, category, subcategory, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const employeeList: Employee[] = (employees ?? []).map((e) => ({
    id: e.id as string,
    name: e.name as string,
  }));

  const today: TodayGasto[] = (outflows ?? []).map((o) => ({
    id: o.id as string,
    amount: Number(o.amount ?? 0),
    category: o.category as OutflowCategory,
    subcategory: (o.subcategory as string | null) ?? null,
    status: o.status as TodayGasto["status"],
    createdAt: format(new Date(o.created_at as string), "HH:mm"),
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/empleado"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Inicio
      </Link>

      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Caja
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Gastos y salidas
      </h1>

      <GastosForm employees={employeeList} today={today} />
    </main>
  );
}
