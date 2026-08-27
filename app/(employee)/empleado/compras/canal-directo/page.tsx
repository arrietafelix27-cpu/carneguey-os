import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getActiveProviders } from "@/lib/cache";
import { CarcassLotForm } from "@/components/employee/carcass-lot-form";
import { getPolicies } from "@/lib/permissions.server";

export const metadata = { title: "Canal directo" };

export default async function CanalDirectoPage() {
  const [providers, policies] = await Promise.all([
    getActiveProviders(),
    getPolicies(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/empleado/compras"
        className="mb-4 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Compras
      </Link>
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-foreground">
        Canal directo de res
      </h1>
      <CarcassLotForm
        type="beef_carcass"
        providers={providers}
        receiptRequired={policies.receipt_carcass_lot}
      />
    </main>
  );
}
