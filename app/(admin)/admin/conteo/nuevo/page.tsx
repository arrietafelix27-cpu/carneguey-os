import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/catalog";
import {
  ConteoSalesEditor,
  type SalesItem,
} from "@/components/admin/conteo-sales-editor";
import {
  ConteoPhysicalEditor,
  type PhysicalItem,
} from "@/components/admin/conteo-physical-editor";

export const metadata = { title: "Conteo en curso" };
export const dynamic = "force-dynamic";

function numToInput(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(".", ",");
}

export default async function ConteoNuevoPage({
  searchParams,
}: {
  searchParams: Promise<{ paso?: string }>;
}) {
  const { paso } = await searchParams;
  const supabase = await createClient();

  const { data: counts } = await supabase
    .from("physical_counts")
    .select("id, status, created_at")
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1);

  const conteo = counts?.[0];
  if (!conteo) redirect("/admin/conteos");

  const { data: items } = await supabase
    .from("v_physical_count_items_admin")
    .select(
      "id, product_id, product_name, category, unit, theoretical_quantity, physical_quantity, actual_quantity",
    )
    .eq("physical_count_id", conteo.id)
    .order("product_name", { ascending: true });

  const rows = items ?? [];
  const step: "ventas" | "fisico" = paso === "fisico" ? "fisico" : "ventas";

  if (step === "fisico") {
    const anySold = rows.some(
      (r) =>
        r.physical_quantity !== null && Number(r.physical_quantity) > 0,
    );
    if (!anySold) redirect("/admin/conteo/nuevo?paso=ventas");
  }

  if (step === "ventas") {
    const initialItems: SalesItem[] = rows.map((r) => ({
      id: r.id as string,
      product_name: r.product_name as string,
      category: r.category as Category,
      unit: (r.unit as "kg" | "unit") ?? "kg",
      theoretical: Number(r.theoretical_quantity ?? 0),
      initialSold: numToInput(r.physical_quantity),
    }));

    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link
          href="/admin/conteos"
          className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
        >
          <ChevronLeft className="size-4" />
          Conteos
        </Link>
        <ConteoSalesEditor
          countId={conteo.id as string}
          initialItems={initialItems}
        />
      </main>
    );
  }

  const initialItems: PhysicalItem[] = rows.map((r) => ({
    id: r.id as string,
    product_name: r.product_name as string,
    category: r.category as Category,
    unit: (r.unit as "kg" | "unit") ?? "kg",
    theoretical: Number(r.theoretical_quantity ?? 0),
    sold:
      r.physical_quantity === null || r.physical_quantity === undefined
        ? 0
        : Number(r.physical_quantity),
    initialActual: numToInput(r.actual_quantity),
  }));

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin/conteo/nuevo?paso=ventas"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Ventas
      </Link>
      <ConteoPhysicalEditor
        countId={conteo.id as string}
        initialItems={initialItems}
      />
    </main>
  );
}
