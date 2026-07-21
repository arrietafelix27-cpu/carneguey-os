import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Bird,
  Beef,
  Scissors,
} from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { formatQty, formatKg } from "@/lib/format";

export const metadata = { title: "Últimas entradas · Carnegüey OS" };

type Kind = "directa" | "lote" | "desposte";

type Event = {
  date: string;
  kind: Kind;
  kindLabel: string;
  title: string;
  detail: string;
  who: string;
  href: string;
};

const ICONS: Record<Kind, typeof ShoppingCart> = {
  directa: Bird,
  lote: Beef,
  desposte: Scissors,
};

const LOT_LABEL: Record<string, string> = {
  beef_live: "Ganado en pie",
  beef_carcass: "Canal de res",
  pork_carcass: "Cerdo en canal",
  poultry_carcass: "Pollo en canal",
};

export default async function EntradasPage() {
  const supabase = await createClient();

  const [
    { data: profiles },
    { data: directPurchases },
    { data: lots },
    { data: despostes },
    { data: desposteSummary },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name"),
    supabase
      .from("direct_purchases")
      .select("id, quantity, created_at, created_by, products(name, unit)")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("purchase_lots")
      .select(
        "id, lot_code, type, carcass_count, carcass_weight_kg, live_animal_count, created_at, created_by",
      )
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("despostes")
      .select(
        "id, input_weight_kg, finalized_at, created_by, purchase_lots(lot_code)",
      )
      .eq("status", "finalized")
      .order("finalized_at", { ascending: false })
      .limit(60),
    supabase
      .from("v_desposte_summary")
      .select("desposte_id, merma_kg, merma_pct"),
  ]);

  const nameOf = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string]),
  );

  const mermaOf = new Map(
    (desposteSummary ?? []).map((d) => [
      d.desposte_id as string,
      {
        kg: Number(d.merma_kg ?? 0),
        pct: Number(d.merma_pct ?? 0),
      },
    ]),
  );

  const events: Event[] = [];

  for (const dp of directPurchases ?? []) {
    const prod = dp.products as unknown as {
      name: string;
      unit: string;
    } | null;
    events.push({
      date: dp.created_at as string,
      kind: "directa",
      kindLabel: "Compra directa",
      title: prod?.name ?? "Producto",
      detail: `${formatQty(Number(dp.quantity))} ${
        prod?.unit === "unit" ? "unidades" : "kg"
      }`,
      who: nameOf.get(dp.created_by as string) ?? "—",
      href: `/admin/compras-directas/${dp.id}`,
    });
  }

  for (const lot of lots ?? []) {
    const type = lot.type as string;
    let detail: string;
    if (type === "beef_live") {
      detail = `${lot.live_animal_count ?? "?"} animales`;
    } else {
      detail = `${lot.carcass_count ?? "?"} canales · ${formatKg(
        Number(lot.carcass_weight_kg ?? 0),
      )} kg`;
    }
    events.push({
      date: lot.created_at as string,
      kind: "lote",
      kindLabel: LOT_LABEL[type] ?? "Lote",
      title: lot.lot_code as string,
      detail,
      who: nameOf.get(lot.created_by as string) ?? "—",
      href: `/admin/lotes/${lot.id}`,
    });
  }

  for (const d of despostes ?? []) {
    const lot = d.purchase_lots as unknown as { lot_code: string } | null;
    const merma = mermaOf.get(d.id as string);
    const mermaText = merma
      ? ` · merma ${formatKg(merma.kg)} kg (${merma.pct.toFixed(1)}%)`
      : "";
    events.push({
      date: (d.finalized_at as string) ?? "",
      kind: "desposte",
      kindLabel: "Desposte",
      title: lot?.lot_code ?? "Lote",
      detail: `entró ${formatKg(Number(d.input_weight_kg))} kg${mermaText}`,
      who: nameOf.get(d.created_by as string) ?? "—",
      href: `/admin/despostes/${d.id}`,
    });
  }

  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = events.slice(0, 60);

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="mb-7 text-3xl font-bold tracking-tight text-foreground">
        Últimas entradas
      </h1>

      {recent.length === 0 ? (
        <div className="rounded-3xl bg-card shadow-sm px-6 py-16 text-center text-sm text-muted-foreground">
          Aún no hay registros.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {recent.map((e, i) => {
            const Icon = ICONS[e.kind];
            return (
              <li
                key={i}
                className={i > 0 ? "border-t border-border/60" : undefined}
              >
                <Link
                  href={e.href}
                  className="flex items-center gap-4 px-5 py-4 transition-colors active:bg-secondary"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foreground">
                      {e.title}
                    </p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {e.kindLabel} · {e.detail}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      {e.who}
                      {e.date
                        ? ` · ${format(new Date(e.date), "dd/MM/yyyy")}`
                        : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
