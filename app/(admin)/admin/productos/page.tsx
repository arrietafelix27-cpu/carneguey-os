import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/catalog";
import { ProductsManager } from "@/components/admin/products-manager";

export const metadata = { title: "Productos · Carnegüey OS" };

export default async function ProductosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, category, unit, origin, pos_code, active")
    .order("name", { ascending: true });

  const products = (data ?? []) as Product[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/admin/operaciones"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Operaciones
      </Link>
      <ProductsManager initialProducts={products} />
    </main>
  );
}
