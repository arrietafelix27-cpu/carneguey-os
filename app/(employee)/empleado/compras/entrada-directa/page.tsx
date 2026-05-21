import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Product, Provider } from "@/lib/catalog";
import { DirectPurchaseForm } from "@/components/employee/direct-purchase-form";

export const metadata = { title: "Pollo y otros · Carnegüey" };

export default async function EntradaDirectaPage() {
  const supabase = await createClient();

  const [{ data: providers }, { data: products }] = await Promise.all([
    supabase
      .from("providers")
      .select("id, name, phone, active")
      .eq("active", true)
      .order("name"),
    supabase
      .from("products")
      .select("id, name, category, unit, origin, pos_code, active")
      .eq("active", true)
      .eq("origin", "direct_purchase")
      .order("name"),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/empleado/compras"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Compras
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">
        Pollo y otros productos
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Productos que entran directo al inventario, sin desposte.
      </p>
      <DirectPurchaseForm
        providers={(providers ?? []) as Provider[]}
        products={(products ?? []) as Product[]}
      />
    </main>
  );
}
