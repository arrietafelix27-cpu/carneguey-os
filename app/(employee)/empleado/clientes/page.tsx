import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  CustomerPayments,
  type PosCustomerBalance,
} from "@/components/employee/customer-payments";

export const metadata = { title: "Clientes · Carnegüey" };
export const dynamic = "force-dynamic";

export default async function ClientesCajeraPage() {
  const supabase = await createClient();

  // Vista definer: solo nombre, teléfono y saldo de clientes activos.
  // No expone cupo de crédito, notas ni descuentos.
  const { data } = await supabase
    .from("v_pos_customer_balances")
    .select("id, name, phone, balance");

  const customers: PosCustomerBalance[] = (data ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    phone: (c.phone as string | null) ?? null,
    balance: Number(c.balance ?? 0),
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
        Cobros
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Clientes
      </h1>

      <CustomerPayments customers={customers} />
    </main>
  );
}
