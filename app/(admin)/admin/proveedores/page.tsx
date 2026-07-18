import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Provider } from "@/lib/catalog";
import { ProvidersManager } from "@/components/admin/providers-manager";

export const metadata = { title: "Proveedores · Carnegüey OS" };

export default async function ProveedoresPage() {
  const supabase = await createClient();
  const [{ data }, { data: balances }] = await Promise.all([
    supabase
      .from("providers")
      .select("id, name, phone, active")
      .order("active", { ascending: false })
      .order("name", { ascending: true }),
    supabase.from("v_supplier_balances").select("provider_id, pending_total"),
  ]);

  const providers = (data ?? []) as Provider[];
  const balanceMap: Record<string, number> = {};
  for (const b of balances ?? []) {
    balanceMap[b.provider_id as string] = Number(b.pending_total);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/admin/operaciones"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Operaciones
      </Link>
      <ProvidersManager initialProviders={providers} balances={balanceMap} />
    </main>
  );
}
