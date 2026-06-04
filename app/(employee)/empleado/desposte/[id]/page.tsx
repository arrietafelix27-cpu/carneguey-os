import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveProducts } from "@/lib/cache";
import {
  DesposteProgress,
  type DesposteItem,
} from "@/components/employee/desposte-progress";

export const metadata = { title: "Desposte en curso · Carnegüey" };

export default async function DesposteEnCursoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: desposte } = await supabase
    .from("despostes")
    .select("id, lot_id, input_weight_kg, status")
    .eq("id", id)
    .single();

  if (!desposte || desposte.status !== "in_progress") {
    redirect("/empleado/desposte");
  }

  const { data: lot } = await supabase
    .from("v_purchase_lots_employee")
    .select("lot_code, type")
    .eq("id", desposte.lot_id)
    .single();

  const category =
    lot?.type === "pork_carcass"
      ? "pork"
      : lot?.type === "poultry_carcass"
        ? "poultry"
        : "beef";

  const [allProducts, { data: items }] = await Promise.all([
    getActiveProducts(),
    supabase
      .from("desposte_items")
      .select("id, product_id, weight_kg, products(name)")
      .eq("desposte_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const products = allProducts.filter((p) => p.category === category);

  const initialItems: DesposteItem[] = (items ?? []).map((it) => {
    const prod = it.products as unknown as { name: string } | null;
    return {
      id: it.id as string,
      product_id: it.product_id as string,
      product_name: prod?.name ?? "Producto",
      weight_kg: Number(it.weight_kg),
    };
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/empleado/desposte"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Despostes
      </Link>
      <DesposteProgress
        desposteId={desposte.id as string}
        lotCode={lot?.lot_code ?? "Lote"}
        inputWeight={Number(desposte.input_weight_kg)}
        products={products}
        initialItems={initialItems}
      />
    </main>
  );
}
