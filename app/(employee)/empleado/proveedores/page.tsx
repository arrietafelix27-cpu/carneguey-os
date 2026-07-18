import Link from "next/link";
import { ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";

export const metadata = { title: "Proveedores · Carnegüey" };
export const dynamic = "force-dynamic";

export default async function ProveedoresCajeraPage() {
  const supabase = await createClient();

  const [{ data: providers }, { data: balances }] = await Promise.all([
    supabase.from("providers").select("id, name, phone").eq("active", true),
    supabase.from("v_supplier_balances").select("provider_id, pending_total"),
  ]);

  const balanceMap = new Map(
    (balances ?? []).map((b) => [
      b.provider_id as string,
      Number(b.pending_total),
    ]),
  );

  // Solo proveedores con gestión abierta: facturas pendientes que la
  // cajera puede ver (RLS de v_supplier_balances ya excluye las privadas).
  const withBalance = (providers ?? [])
    .map((p) => ({
      id: p.id as string,
      name: p.name as string,
      phone: p.phone as string | null,
      pending: balanceMap.get(p.id as string) ?? 0,
    }))
    .filter((p) => p.pending > 0)
    .sort((a, b) => b.pending - a.pending);

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
        Proveedores
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Cuentas por pagar
      </h1>

      {withBalance.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
          No hay proveedores con facturas pendientes.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {withBalance.map((p, i) => (
            <li
              key={p.id}
              className={i > 0 ? "border-t border-border" : undefined}
            >
              <Link
                href={`/empleado/proveedores/${p.id}`}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-secondary"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-red-soft)] text-primary">
                  <Truck className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-foreground">
                    {p.name}
                  </span>
                  <span className="block text-[13px] text-secondary-foreground">
                    {p.phone ?? "Sin teléfono"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold text-danger tabular-nums">
                    {formatCOP(p.pending)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    pendiente
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-text-tertiary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
