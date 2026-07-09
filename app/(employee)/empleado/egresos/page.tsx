import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { OutflowCategory } from "@/lib/validations/cash-outflow";
import {
  CashOutflowForm,
  type TodayOutflow,
} from "@/components/employee/cash-outflow-form";

export const metadata = { title: "Egresos · Carnegüey" };
export const dynamic = "force-dynamic";

export default async function EgresosCajeraPage() {
  const supabase = await createClient();

  // La RLS ya limita a los egresos propios del día actual.
  const { data } = await supabase
    .from("cash_outflows")
    .select("id, amount, category, recipient, status, created_at")
    .order("created_at", { ascending: false });

  const today: TodayOutflow[] = (data ?? []).map((o) => ({
    id: o.id as string,
    amount: Number(o.amount ?? 0),
    category: o.category as OutflowCategory,
    recipient: (o.recipient as string | null) ?? null,
    status: o.status as TodayOutflow["status"],
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
        Egresos de efectivo
      </h1>

      <CashOutflowForm today={today} />
    </main>
  );
}
