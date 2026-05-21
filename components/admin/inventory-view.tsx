"use client";

import { useMemo, useState } from "react";
import { Search, Boxes } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/catalog";
import { formatQty, formatCOP } from "@/lib/format";
import { Input } from "@/components/ui/input";

export type InvItem = {
  id: string;
  kind: "canal" | "producto";
  category: Category | null;
  name: string;
  lotCode: string | null;
  quantity: number;
  unit: "kg" | "unit";
  unitCost: number;
  totalValue: number;
};

type Filter = "todos" | "canales" | Category;
type Sort = "categoria" | "valor" | "alfabetico";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "canales", label: "Canales" },
  { key: "beef", label: "Res" },
  { key: "pork", label: "Cerdo" },
  { key: "poultry", label: "Pollo" },
  { key: "other", label: "Otros" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "categoria", label: "Por categoría" },
  { key: "valor", label: "Por mayor valor" },
  { key: "alfabetico", label: "Alfabético" },
];

function groupLabel(item: InvItem): string {
  if (item.kind === "canal") return "Canales sin despostar";
  return CATEGORY_LABELS[item.category ?? "other"];
}

function categoryRank(item: InvItem): number {
  if (item.kind === "canal") return -1;
  return CATEGORY_ORDER.indexOf(item.category ?? "other");
}

export function InventoryView({ items }: { items: InvItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [sort, setSort] = useState<Sort>("categoria");

  const grandTotal = useMemo(
    () => items.reduce((s, it) => s + it.totalValue, 0),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((it) => {
      if (q && !it.name.toLowerCase().includes(q)) return false;
      if (filter === "todos") return true;
      if (filter === "canales") return it.kind === "canal";
      return it.kind === "producto" && it.category === filter;
    });

    const sorted = [...filtered];
    if (sort === "valor") {
      sorted.sort((a, b) => b.totalValue - a.totalValue);
    } else if (sort === "alfabetico") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "es"));
    } else {
      sorted.sort(
        (a, b) =>
          categoryRank(a) - categoryRank(b) ||
          a.name.localeCompare(b.name, "es"),
      );
    }
    return sorted;
  }, [items, query, filter, sort]);

  // Agrupación visible solo cuando el orden es por categoría.
  const groups = useMemo(() => {
    if (sort !== "categoria") return [{ label: "", items: visible }];
    const map = new Map<string, InvItem[]>();
    for (const it of visible) {
      const g = groupLabel(it);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(it);
    }
    return [...map.entries()].map(([label, items]) => ({ label, items }));
  }, [visible, sort]);

  return (
    <div>
      <div className="mb-6 rounded-xl bg-primary px-5 py-4 text-primary-foreground">
        <p className="text-xs uppercase tracking-wide opacity-80">
          Valor total del inventario
        </p>
        <p className="text-3xl font-bold">{formatCOP(grandTotal)}</p>
        <p className="mt-1 text-xs opacity-80">
          Toda la plata invertida en lo que hay hoy en el negocio.
        </p>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar"
          className="pl-9"
          inputMode="search"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-5 flex gap-2">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              sort === s.key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Boxes className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium text-foreground">Inventario vacío</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Aún no hay canales ni productos con existencia. Aparecerán aquí
            cuando las cajeras registren compras y despostes.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Nada coincide con el filtro o la búsqueda.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g, gi) => {
            const subtotal = g.items.reduce((s, it) => s + it.totalValue, 0);
            return (
              <section key={gi}>
                {g.label && (
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.label}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {formatCOP(subtotal)}
                    </span>
                  </div>
                )}
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {g.items.map((it) => (
                    <li key={it.id} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate font-medium text-foreground">
                          {it.name}
                        </p>
                        <p className="shrink-0 font-semibold text-foreground tabular-nums">
                          {formatCOP(it.totalValue)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                        {formatQty(it.quantity)}{" "}
                        {it.unit === "kg" ? "kg" : "u"} ·{" "}
                        {formatCOP(it.unitCost)} /
                        {it.unit === "kg" ? "kg" : "u"}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
