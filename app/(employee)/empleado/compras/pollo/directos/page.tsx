import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveProviders, getActiveProducts } from "@/lib/cache";
import { DirectPurchaseForm } from "@/components/employee/direct-purchase-form";

export const metadata = { title: "Pollo · Productos directos" };

export default async function PolloDirectosPage() {
  const [providers, allProducts] = await Promise.all([
    getActiveProviders(),
    getActiveProducts(),
  ]);
  const products = allProducts.filter(
    (p) => p.category === "poultry" && p.origin === "direct_purchase",
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/empleado/compras/pollo"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Pollo
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">
        Pollo · productos directos
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Productos de pollo que entran directo al inventario.
      </p>
      <DirectPurchaseForm providers={providers} products={products} />
    </main>
  );
}
