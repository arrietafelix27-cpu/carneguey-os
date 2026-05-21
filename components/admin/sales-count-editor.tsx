"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/catalog";
import { formatQty } from "@/lib/format";
import { updateSalesItem, completeSalesCount } from "@/lib/actions/conteo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type CountItem = {
  id: string;
  product_name: string;
  category: Category;
  unit: "kg" | "unit";
  theoretical: number;
  sold: string;
};

export function SalesCountEditor({
  countId,
  initialItems,
}: {
  countId: string;
  initialItems: CountItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<CountItem[]>(initialItems);
  const [query, setQuery] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const soldNumber = (s: string) => {
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  function setSold(id: string, value: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, sold: value } : it)),
    );
  }

  function saveSold(item: CountItem) {
    updateSalesItem(item.id, item.sold).then((r) => {
      if ("error" in r) toast.error(r.error);
    });
  }

  function finalize() {
    startTransition(async () => {
      const result = await completeSalesCount(countId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Conteo finalizado. El inventario se actualizó.");
      setConfirmOpen(false);
      router.push("/admin/conteo");
    });
  }

  const withSales = items.filter((it) => soldNumber(it.sold) > 0).length;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = items.filter(
      (it) => q === "" || it.product_name.toLowerCase().includes(q),
    );
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: visible.filter((it) => it.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [items, query]);

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto"
          className="pl-9"
          inputMode="search"
        />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No hay productos con existencia para contar.
          </p>
        </div>
      ) : (
        <div className="space-y-6 pb-4">
          {groups.map(({ cat, items: group }) => (
            <section key={cat}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[cat]}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {group.map((it) => {
                  const expected = it.theoretical - soldNumber(it.sold);
                  const u = it.unit === "kg" ? "kg" : "u";
                  return (
                    <li key={it.id} className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {it.product_name}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="text-xs text-muted-foreground">
                          Había
                          <br />
                          <span className="text-sm font-medium text-foreground tabular-nums">
                            {formatQty(it.theoretical)} {u}
                          </span>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground">
                            Vendido ({u})
                          </label>
                          <Input
                            inputMode="decimal"
                            placeholder="0"
                            value={it.sold}
                            onChange={(e) => setSold(it.id, e.target.value)}
                            onBlur={() => saveSold(it)}
                          />
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          Debe quedar
                          <br />
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              expected < 0
                                ? "text-destructive"
                                : "text-primary"
                            }`}
                          >
                            {formatQty(expected)} {u}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-card px-4 py-3 sm:-mx-6 sm:px-6">
        <Button
          className="h-12 w-full text-base font-semibold"
          disabled={isPending || items.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Finalizar conteo
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar conteo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Registraste ventas en {withSales}{" "}
            {withSales === 1 ? "producto" : "productos"}. Al finalizar, el
            inventario baja a lo que debe quedar. No se puede deshacer.
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
            >
              Volver
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={finalize}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
