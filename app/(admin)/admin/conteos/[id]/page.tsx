import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/catalog";
import { formatQty } from "@/lib/format";

export const metadata = { title: "Conteo" };
export const dynamic = "force-dynamic";

type Band = "green" | "yellow" | "red";

function bandFor(diff: number, shouldBe: number): Band {
  const abs = Math.abs(diff);
  if (abs < 0.005) return "green";
  if (shouldBe <= 0) return "red";
  const pct = (abs / shouldBe) * 100;
  if (pct <= 3) return "green";
  if (pct <= 8) return "yellow";
  return "red";
}

const BAND_STYLES: Record<Band, { bg: string; text: string }> = {
  green: { bg: "bg-success/15", text: "text-success" },
  yellow: { bg: "bg-warning/15", text: "text-warning" },
  red: { bg: "bg-danger/15", text: "text-danger" },
};

const STATUS_META: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  completed: {
    label: "Completado",
    bg: "bg-success/15",
    text: "text-success",
  },
  cancelled: {
    label: "Cancelado",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
  in_progress: {
    label: "En progreso",
    bg: "bg-warning/15",
    text: "text-warning",
  },
};

export default async function ConteoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conteo } = await supabase
    .from("physical_counts")
    .select(
      "id, status, count_date, completed_at, created_at, notes, created_by",
    )
    .eq("id", id)
    .single();

  if (!conteo) redirect("/admin/conteos");
  if (conteo.status === "in_progress") redirect("/admin/conteo/nuevo");

  const [{ data: items }, { data: prof }] = await Promise.all([
    supabase
      .from("v_physical_count_items_admin")
      .select(
        "id, product_name, category, unit, theoretical_quantity, physical_quantity, actual_quantity",
      )
      .eq("physical_count_id", id)
      .order("product_name", { ascending: true }),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", conteo.created_by)
      .single(),
  ]);

  const rows = (items ?? []).map((r) => {
    const theoretical = Number(r.theoretical_quantity ?? 0);
    const sold =
      r.physical_quantity === null || r.physical_quantity === undefined
        ? 0
        : Number(r.physical_quantity);
    const actual =
      r.actual_quantity === null || r.actual_quantity === undefined
        ? null
        : Number(r.actual_quantity);
    const shouldBe = Math.round((theoretical - sold) * 100) / 100;
    const diff =
      actual === null ? null : Math.round((actual - shouldBe) * 100) / 100;
    const band = diff === null ? null : bandFor(diff, shouldBe);
    return {
      id: r.id as string,
      name: r.product_name as string,
      category: r.category as Category,
      unit: (r.unit as "kg" | "unit") ?? "kg",
      theoretical,
      sold,
      shouldBe,
      actual,
      diff,
      band,
    };
  });

  const counted = rows.filter((r) => r.actual !== null);
  const green = counted.filter((r) => r.band === "green").length;
  const yellow = counted.filter((r) => r.band === "yellow").length;
  const red = counted.filter((r) => r.band === "red").length;

  const statusMeta =
    STATUS_META[conteo.status as string] ?? STATUS_META.cancelled;
  const isCancelled = conteo.status === "cancelled";

  const groups = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: rows.filter((r) => r.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin/conteos"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Conteos
      </Link>

      <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Conteo quincenal
      </p>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        {format(
          new Date((conteo.completed_at ?? conteo.created_at) as string),
          "dd/MM/yyyy",
        )}
      </h1>
      <div className="mb-6 mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.bg} ${statusMeta.text}`}
        >
          {statusMeta.label}
        </span>
        <span>· {prof?.full_name ?? "—"}</span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card shadow-sm px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Inició
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {format(new Date(conteo.created_at as string), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
        <div className="rounded-2xl bg-card shadow-sm px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            {isCancelled ? "Cancelado" : "Finalizó"}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {conteo.completed_at
              ? format(
                  new Date(conteo.completed_at as string),
                  "dd/MM/yyyy HH:mm",
                )
              : "—"}
          </p>
        </div>
      </div>

      {!isCancelled && (
        <div className="mb-6 grid grid-cols-4 gap-2 text-center">
          <Stat label="Contados" value={counted.length} />
          <Stat
            label="OK"
            value={green}
            bg="bg-success/10"
            text="text-success"
          />
          <Stat
            label="Mod."
            value={yellow}
            bg="bg-warning/10"
            text="text-warning"
          />
          <Stat
            label="Alta"
            value={red}
            bg="bg-danger/10"
            text="text-danger"
          />
        </div>
      )}

      {isCancelled && (
        <div className="mb-6 rounded-3xl bg-muted/50 px-6 py-4 text-sm text-muted-foreground">
          Este conteo fue cancelado. El inventario no se modificó. Lo de abajo
          es lo que se alcanzó a registrar.
        </div>
      )}

      {groups.length === 0 ? (
        <div className="rounded-3xl bg-card shadow-sm px-6 py-16 text-center text-sm text-muted-foreground">
          Sin productos en este conteo.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ cat, items: group }) => (
            <section key={cat}>
              <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                {CATEGORY_LABELS[cat]}
              </h2>
              <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
                {group.map((r, i) => {
                  const u = r.unit === "kg" ? "kg" : "u";
                  const style = r.band ? BAND_STYLES[r.band] : null;
                  return (
                    <li
                      key={r.id}
                      className={`px-5 py-3.5 ${
                        i > 0 ? "border-t border-border/60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-medium text-foreground">
                          {r.name}
                        </p>
                        {style && r.diff !== null && (
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${style.bg} ${style.text}`}
                          >
                            {r.diff > 0 ? "+" : ""}
                            {formatQty(r.diff)} {u}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 grid grid-cols-4 gap-2 text-[11px] tabular-nums">
                        <Cell
                          label="Había"
                          value={`${formatQty(r.theoretical)} ${u}`}
                        />
                        <Cell
                          label="Vendido"
                          value={`${formatQty(r.sold)} ${u}`}
                        />
                        <Cell
                          label="Debía"
                          value={`${formatQty(r.shouldBe)} ${u}`}
                        />
                        <Cell
                          label="Real"
                          value={
                            r.actual === null
                              ? "—"
                              : `${formatQty(r.actual)} ${u}`
                          }
                          highlight
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {conteo.notes && (
        <div className="mt-6 rounded-2xl bg-card shadow-sm px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Notas
          </p>
          <p className="mt-1 text-sm text-foreground">
            {conteo.notes as string}
          </p>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  bg,
  text,
}: {
  label: string;
  value: number;
  bg?: string;
  text?: string;
}) {
  return (
    <div className={`rounded-2xl px-3 py-3 ${bg ?? "bg-card"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-bold tabular-nums ${text ?? "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}

function Cell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-muted-foreground">{label}</p>
      <p
        className={`truncate ${
          highlight ? "font-semibold text-foreground" : "text-foreground/80"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
