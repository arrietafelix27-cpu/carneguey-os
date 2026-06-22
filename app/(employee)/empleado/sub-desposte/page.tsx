import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import {
  SubDesposteForm,
  type SourceProduct,
  type OutputProduct,
} from "@/components/employee/sub-desposte-form";

export const metadata = { title: "Sub-desposte · Carnegüey" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; bg: string; text: string }> =
  {
    pending: { label: "Pendiente", bg: "bg-warning/15", text: "text-warning" },
    approved: { label: "Aprobado", bg: "bg-success/15", text: "text-success" },
    rejected: {
      label: "Rechazado",
      bg: "bg-[var(--bg-muted)]",
      text: "text-secondary-foreground",
    },
  };

export default async function SubDespostePage() {
  const supabase = await createClient();

  const [{ data: products }, { data: stock }, { data: subs }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, unit, active")
        .eq("active", true)
        .order("name", { ascending: true }),
      supabase
        .from("v_current_inventory_employee")
        .select("product_id, quantity_in_stock"),
      supabase
        .from("sub_despostes")
        .select("id, source_product_id, source_kg, status, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  const stockBy = new Map(
    (stock ?? []).map((s) => [
      s.product_id as string,
      Number(s.quantity_in_stock ?? 0),
    ]),
  );
  const nameBy = new Map(
    (products ?? []).map((p) => [p.id as string, p.name as string]),
  );

  const outputs: OutputProduct[] = (products ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    unit: (p.unit as "kg" | "unit") ?? "kg",
  }));

  // Origen: productos en kg con existencia.
  const sources: SourceProduct[] = (products ?? [])
    .filter((p) => p.unit === "kg")
    .map((p) => ({
      id: p.id as string,
      name: p.name as string,
      stock: Math.round((stockBy.get(p.id as string) ?? 0) * 100) / 100,
    }))
    .filter((s) => s.stock > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  const recent = subs ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/empleado"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Inicio
      </Link>

      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Proceso
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Sub-desposte
      </h1>

      <SubDesposteForm sources={sources} products={outputs} />

      {recent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Últimos sub-despostes
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {recent.map((s, i) => {
              const meta =
                STATUS_META[s.status as string] ?? STATUS_META.rejected;
              return (
                <li
                  key={s.id as string}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {nameBy.get(s.source_product_id as string) ?? "Producto"}
                    </p>
                    <p className="text-[13px] text-secondary-foreground tabular-nums">
                      {Number(s.source_kg).toFixed(2)} kg ·{" "}
                      {format(new Date(s.created_at as string), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}
