import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bogotaToday } from "@/lib/dates";
import { DayClosing, type DaySummary } from "@/components/employee/day-closing";

export const metadata = { title: "Cerrar día · Carnegüey" };
export const dynamic = "force-dynamic";

export default async function CierreCajeraPage() {
  const supabase = await createClient();
  const today = bogotaToday();

  // fn_daily_summary es SECURITY DEFINER: la cajera no lee sales ni
  // credit_payments, solo recibe los totales agregados que necesita.
  const [{ data: summaryRows }, { data: closing }] = await Promise.all([
    supabase.rpc("fn_daily_summary", { p_date: today }),
    supabase
      .from("daily_closings")
      .select("id, status")
      .eq("closing_date", today)
      .maybeSingle(),
  ]);

  const s = Array.isArray(summaryRows) ? summaryRows[0] : summaryRows;
  const summary: DaySummary = {
    salesCash: Number(s?.sales_cash ?? 0),
    salesCard: Number(s?.sales_card ?? 0),
    salesTransfer: Number(s?.sales_transfer ?? 0),
    creditSales: Number(s?.credit_sales ?? 0),
    cpCash: Number(s?.cp_cash ?? 0),
    cpCard: Number(s?.cp_card ?? 0),
    cpTransfer: Number(s?.cp_transfer ?? 0),
    outflowsApproved: Number(s?.outflows_approved ?? 0),
    outflowsPending: Number(s?.outflows_pending ?? 0),
    expectedCash: Number(s?.expected_cash ?? 0),
  };

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
        Cerrar día
      </h1>

      <DayClosing
        summary={summary}
        alreadyClosed={closing?.status === "closed"}
      />
    </main>
  );
}
