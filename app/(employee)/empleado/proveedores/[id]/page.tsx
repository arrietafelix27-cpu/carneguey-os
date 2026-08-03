import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSupplierAccount } from "@/lib/suppliers";
import { SupplierAccountView } from "@/components/shared/supplier-account-view";

export const metadata = { title: "Proveedor" };
export const dynamic = "force-dynamic";

export default async function ProveedorCajeraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("providers")
    .select("id, name, phone, active, is_private")
    .eq("id", id)
    .single();

  if (!provider) redirect("/empleado/proveedores");

  const { invoices, payments, pendingTotal } = await getSupplierAccount(
    supabase,
    id,
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/empleado/proveedores"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Proveedores
      </Link>

      <h1 className="text-[28px] font-bold tracking-tight text-foreground">
        {provider.name}
      </h1>
      <p className="mb-6 mt-1 text-[15px] text-secondary-foreground">
        {provider.phone ?? "Sin teléfono"}
      </p>

      <SupplierAccountView
        providerId={id}
        providerIsPrivate={provider.is_private as boolean}
        invoices={invoices}
        payments={payments}
        pendingTotal={pendingTotal}
        isAdmin={false}
      />
    </main>
  );
}
