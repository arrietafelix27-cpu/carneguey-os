import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveProviders } from "@/lib/cache";
import { CarcassLotForm } from "@/components/employee/carcass-lot-form";

export const metadata = { title: "Pollo para desposte · Carnegüey" };

export default async function PolloDespostePage() {
  const providers = await getActiveProviders();

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
        Pollo para desposte
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Pollos enteros que entran al cuarto frío para despostarse después.
      </p>
      <CarcassLotForm type="poultry_carcass" providers={providers} />
    </main>
  );
}
