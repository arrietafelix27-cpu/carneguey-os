import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  CustomersManager,
  type CustomerRow,
  type DiscountType,
} from "@/components/admin/customers-manager";

export const metadata = { title: "Clientes · Carnegüey OS" };
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const supabase = await createClient();

  const [{ data: customers }, { data: balances }] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, name, phone, discount_type, discount_value, credit_limit, active, notes",
      )
      .order("name", { ascending: true }),
    supabase.from("v_customer_balances").select("customer_id, balance"),
  ]);

  const balanceBy = new Map(
    (balances ?? []).map((b) => [
      b.customer_id as string,
      Number(b.balance ?? 0),
    ]),
  );

  const rows: CustomerRow[] = (customers ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    phone: (c.phone as string | null) ?? null,
    discount_type: (c.discount_type as DiscountType) ?? null,
    discount_value: Number(c.discount_value ?? 0),
    credit_limit: Number(c.credit_limit ?? 0),
    active: c.active as boolean,
    notes: (c.notes as string | null) ?? null,
    balance: balanceBy.get(c.id as string) ?? 0,
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
      <CustomersManager initialCustomers={rows} />
    </main>
  );
}
