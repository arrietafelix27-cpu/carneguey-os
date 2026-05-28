import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveProviders, getActiveProducts } from "@/lib/cache";
import { DirectPurchaseForm } from "@/components/employee/direct-purchase-form";

export const metadata = { title: "Pollo y otros · Carnegüey" };

export default async function EntradaDirectaPage() {
  const [providers, allProducts] = await Promise.all([
    getActiveProviders(),
    getActiveProducts(),
  ]);
  const products = allProducts.filter((p) => p.origin === "direct_purchase");

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
      <DirectPurchaseForm providers={providers} products={products} />
    </main>
  );
}
