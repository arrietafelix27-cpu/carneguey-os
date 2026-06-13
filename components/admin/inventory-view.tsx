"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Boxes, ChevronRight } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/catalog";
import { formatQty, formatCOP } from "@/lib/format";
import { Input } from "@/components/ui/input";

export type InvItem = {
  id: string;
  kind: "canal" | "producto";
  category: Category | null;
  name: string;
  lotCode: string | null;
  lotId: string | null;
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
  { key: "categoria", label: "Categoría" },
  { key: "valor", label: "Mayor valor" },
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
      {/* Valor total — titular */}
      <div className="mb-7 rounded-3xl bg-primary px-6 py-6 text-primary-foreground shadow-[var(--shadow-brand)]">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          Valor del inventario
        </p>
        <p className="mt-1.5 text-[34px] font-bold leading-none tracking-tight tabular-nums">
          {formatCOP(grandTotal)}
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-text-tertiary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar"
          className="pl-11"
          inputMode="search"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all active:scale-95 ${
              filter === f.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-[var(--bg-tertiary)] text-secondary-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-7 flex gap-1.5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              sort === s.key
                ? "bg-[var(--brand-red-soft)] text-primary"
                : "text-text-tertiary"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl bg-card shadow-sm px-6 py-16 text-center">
          <Boxes className="mx-auto mb-4 size-12 text-text-tertiary" />
          <p className="text-[17px] font-semibold text-foreground">
            Inventario vacío
          </p>
          <p className="mx-auto mt-1 max-w-xs text-[15px] text-secondary-foreground">
            Aparecerá aquí cuando las cajeras registren compras y despostes.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl bg-card shadow-sm px-6 py-12 text-center text-[15px] text-secondary-foreground">
          Nada coincide con el filtro o la búsqueda.
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((g, gi) => (
            <section key={gi}>
              {g.label && (
                <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                  {g.label}
                </h2>
              )}
              <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
                {g.items.map((it, i) => {
                  const u = it.unit === "kg" ? "kg" : "u";
                  const inner = (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-foreground">
                          {it.name}
                        </p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                          {formatQty(it.quantity)}
                          <span className="ml-1 text-base font-normal text-muted-foreground">
                            {u}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
                          {formatCOP(it.totalValue)}
                          <span className="text-muted-foreground/70">
                            {"  ·  "}
                            {formatCOP(it.unitCost)}/{u}
                          </span>
                        </p>
                      </div>
                      {it.kind === "canal" && it.lotId && (
                        <ChevronRight className="size-5 shrink-0 self-center text-muted-foreground/60" />
                      )}
                    </>
                  );
                  return (
                    <li
                      key={it.id}
                      className={
                        i > 0 ? "border-t border-border/60" : undefined
                      }
                    >
                      {it.kind === "canal" && it.lotId ? (
                        <Link
                          href={`/admin/lotes/${it.lotId}`}
                          className="flex gap-3 px-5 py-4 transition-colors active:bg-secondary"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex gap-3 px-5 py-4">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
