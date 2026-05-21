import Link from "next/link";
import { ChevronLeft, ShoppingCart, Bird, Beef, Scissors } from "lucide-react";
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
};

export default async function EntradasPage() {
  const supabase = await createClient();

  const [
    { data: profiles },
    { data: directPurchases },
    { data: lots },
    { data: despostes },
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
  ]);

  const nameOf = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string]),
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
    });
  }

  for (const d of despostes ?? []) {
    const lot = d.purchase_lots as unknown as { lot_code: string } | null;
    events.push({
      date: (d.finalized_at as string) ?? "",
      kind: "desposte",
      kindLabel: "Desposte",
      title: lot?.lot_code ?? "Lote",
      detail: `entró ${formatKg(Number(d.input_weight_kg))} kg`,
      who: nameOf.get(d.created_by as string) ?? "—",
    });
  }

  events.sort((a, b) => (a.date < b.date ? 1 : -1));
  const recent = events.slice(0, 60);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Últimas entradas
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Todo lo que han registrado, de lo más reciente a lo más antiguo.
      </p>

      {recent.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no hay registros.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {recent.map((e, i) => {
            const Icon = ICONS[e.kind];
            return (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {e.title}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {e.kindLabel} · {e.detail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.who}
                    {e.date
                      ? ` · ${format(new Date(e.date), "dd/MM/yyyy")}`
                      : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
