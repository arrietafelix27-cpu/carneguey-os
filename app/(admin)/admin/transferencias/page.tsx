import Link from "next/link";
import { ChevronLeft, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatQty } from "@/lib/format";
import { TransferReview } from "@/components/admin/transfer-review";

export const metadata = { title: "Transferencias · Carnegüey OS" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; bg: string; text: string }> =
  {
    approved: { label: "Aprobada", bg: "bg-success/15", text: "text-success" },
    rejected: {
      label: "Rechazada",
      bg: "bg-[var(--bg-muted)]",
      text: "text-secondary-foreground",
    },
  };

export default async function TransferenciasAdminPage() {
  const supabase = await createClient();

  const { data: transfers } = await supabase
    .from("cut_transfers")
    .select(
      "id, source_product_id, dest_product_id, quantity_kg, status, notes, created_by, created_at, reviewed_at",
    )
    .order("created_at", { ascending: false })
    .limit(60);

  const all = transfers ?? [];
  const productIds = new Set<string>();
  const personIds = new Set<string>();
  for (const t of all) {
    productIds.add(t.source_product_id as string);
    productIds.add(t.dest_product_id as string);
    personIds.add(t.created_by as string);
  }

  const [{ data: products }, { data: profiles }] = await Promise.all([
    productIds.size > 0
      ? supabase
          .from("products")
          .select("id, name")
          .in("id", Array.from(productIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    personIds.size > 0
      ? supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(personIds))
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  const nameBy = new Map(
    (products ?? []).map((p) => [p.id as string, p.name as string]),
  );
  const personBy = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const pending = all.filter((t) => t.status === "pending");
  const history = all.filter((t) => t.status !== "pending");

  const label = (id: string) => nameBy.get(id) ?? "Corte";

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Transferencias de cortes
      </h1>
      <p className="mb-7 mt-1 text-[15px] text-secondary-foreground">
        Movimientos 1:1 que registró la cajera. Solo al aprobar cambian el
        inventario.
      </p>

      <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Pendientes ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
          No hay transferencias pendientes.
        </div>
      ) : (
        <ul className="grid gap-3">
          {pending.map((t) => (
            <li key={t.id as string} className="rounded-3xl bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[17px] font-semibold text-foreground">
                <span>{label(t.source_product_id as string)}</span>
                <ArrowRight className="size-4 shrink-0 text-primary" />
                <span>{label(t.dest_product_id as string)}</span>
              </div>
              <p className="mt-1 text-[15px] font-semibold text-primary tabular-nums">
                {formatQty(Number(t.quantity_kg))} kg
              </p>
              <p className="mt-1 text-[13px] text-secondary-foreground">
                {personBy.get(t.created_by as string) ?? "—"} ·{" "}
                {format(new Date(t.created_at as string), "dd/MM/yyyy HH:mm")}
              </p>
              {t.notes && (
                <p className="mt-2 rounded-2xl bg-secondary px-4 py-2.5 text-[14px] text-foreground">
                  {t.notes as string}
                </p>
              )}
              <div className="mt-4">
                <TransferReview
                  transferId={t.id as string}
                  summary={`${formatQty(Number(t.quantity_kg))} kg de ${label(
                    t.source_product_id as string,
                  )} pasan a ${label(t.dest_product_id as string)}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Historial
          </h2>
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {history.map((t, i) => {
              const meta =
                STATUS_META[t.status as string] ?? STATUS_META.rejected;
              return (
                <li
                  key={t.id as string}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {label(t.source_product_id as string)} →{" "}
                      {label(t.dest_product_id as string)}
                    </p>
                    <p className="text-[13px] text-secondary-foreground tabular-nums">
                      {formatQty(Number(t.quantity_kg))} kg ·{" "}
                      {t.reviewed_at
                        ? format(new Date(t.reviewed_at as string), "dd/MM/yyyy")
                        : format(
                            new Date(t.created_at as string),
                            "dd/MM/yyyy",
                          )}
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
