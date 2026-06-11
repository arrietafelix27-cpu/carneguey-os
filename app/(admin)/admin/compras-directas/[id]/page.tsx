import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatQty } from "@/lib/format";
import { getReceiptSignedUrls } from "@/lib/receipts";
import { ReceiptViewer } from "@/components/admin/receipt-viewer";

export const metadata = { title: "Compra directa · Carnegüey OS" };

const CATEGORY_LABEL: Record<string, string> = {
  beef: "Res",
  pork: "Cerdo",
  poultry: "Pollo",
  other: "Otros",
};

export default async function CompraDirectaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: dp } = await supabase
    .from("direct_purchases")
    .select(
      "id, provider_id, product_id, quantity, purchase_date, notes, created_at, created_by, products(name, unit, category)",
    )
    .eq("id", id)
    .single();

  if (!dp) redirect("/admin/entradas");

  const [{ data: prov }, { data: prof }, urls] = await Promise.all([
    supabase
      .from("providers")
      .select("name")
      .eq("id", dp.provider_id)
      .single(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", dp.created_by)
      .single(),
    getReceiptSignedUrls(supabase, "direct_purchase", id),
  ]);

  const product = dp.products as unknown as {
    name: string;
    unit: string;
    category: string;
  } | null;
  const unit = product?.unit === "unit" ? "unidades" : "kg";
  const quantity = Number(dp.quantity ?? 0);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin/entradas"
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Últimas entradas
      </Link>

      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Compra directa
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {product?.name ?? "Producto"}
      </h1>
      <p className="mb-1 text-sm text-muted-foreground">
        {CATEGORY_LABEL[product?.category ?? ""] ?? "—"}
        {prov?.name ? ` · ${prov.name}` : ""}
      </p>
      <p className="mb-6 text-xs text-muted-foreground">
        {format(
          new Date((dp.created_at as string) ?? (dp.purchase_date as string)),
          "dd/MM/yyyy HH:mm",
        )}{" "}
        · {prof?.full_name ?? "—"}
      </p>

      {/* Cantidad destacada */}
      <div className="mb-6 rounded-3xl bg-card px-6 py-5 text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Entró al inventario
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-foreground tabular-nums">
          {formatQty(quantity)}{" "}
          <span className="text-2xl font-normal text-muted-foreground">
            {unit}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fecha de compra: {format(new Date(dp.purchase_date as string), "dd/MM/yyyy")}
        </p>
      </div>

      {/* Comprobante */}
      <div className="mb-6">
        <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Comprobante
        </h2>
        <ReceiptViewer urls={urls} />
      </div>

      {dp.notes && (
        <div className="rounded-2xl bg-card px-5 py-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Notas
          </p>
          <p className="mt-1 text-sm text-foreground">{dp.notes as string}</p>
        </div>
      )}
    </main>
  );
}
