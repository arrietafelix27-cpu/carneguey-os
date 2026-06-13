"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/catalog";
import { formatQty } from "@/lib/format";
import {
  saveSalesQuincenal,
  cancelQuincenalCount,
} from "@/lib/actions/conteo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type SalesItem = {
  id: string;
  product_name: string;
  category: Category;
  unit: "kg" | "unit";
  theoretical: number;
  initialSold: string;
};

function soldNumber(s: string): number {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ConteoSalesEditor({
  countId,
  initialItems,
}: {
  countId: string;
  initialItems: SalesItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(
    initialItems.map((it) => ({ ...it, sold: it.initialSold })),
  );
  const [query, setQuery] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setSold(id: string, value: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, sold: value } : it)),
    );
  }

  function payload() {
    return items.map((it) => ({ item_id: it.id, sold: it.sold.trim() }));
  }

  function saveAndExit() {
    startTransition(async () => {
      const r = await saveSalesQuincenal(countId, payload());
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Ventas guardadas. Puedes continuar después.");
      router.push("/admin/conteos");
    });
  }

  function saveAndAdvance() {
    startTransition(async () => {
      const r = await saveSalesQuincenal(countId, payload());
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.push("/admin/conteo/nuevo?paso=fisico");
    });
  }

  function doCancel() {
    startTransition(async () => {
      const r = await cancelQuincenalCount(countId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Conteo cancelado. El inventario no se modificó.");
      router.push("/admin/conteos");
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
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Paso 1 de 2
          </p>
          <h2 className="text-xl font-bold text-foreground">
            Registro de ventas
          </h2>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {withSales} con ventas
        </span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl bg-card shadow-sm px-6 py-16 text-center text-sm text-muted-foreground">
          No hay productos con existencia para contar. Puedes cancelar este
          conteo desde el botón de abajo.
        </div>
      ) : (
        <>
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

          <div className="space-y-6 pb-40">
            {groups.map(({ cat, items: group }) => (
              <section key={cat}>
                <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
                  {group.map((it, i) => {
                    const u = it.unit === "kg" ? "kg" : "u";
                    return (
                      <li
                        key={it.id}
                        className={`grid grid-cols-[1fr_8rem] items-center gap-3 px-5 py-3.5 ${
                          i > 0 ? "border-t border-border/60" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium text-foreground">
                            {it.product_name}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Hay {formatQty(it.theoretical)} {u}
                          </p>
                        </div>
                        <div>
                          <Input
                            inputMode={
                              it.unit === "unit" ? "numeric" : "decimal"
                            }
                            placeholder="0"
                            value={it.sold}
                            onChange={(e) => setSold(it.id, e.target.value)}
                            className="text-right"
                          />
                          <p className="mt-0.5 text-right text-[10px] uppercase tracking-wider text-muted-foreground">
                            Vendido ({u})
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <div className="sticky bottom-0 -mx-5 mt-6 border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          <Button
            className="h-12 text-base font-semibold"
            disabled={isPending || withSales === 0}
            onClick={saveAndAdvance}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Continuar al conteo físico
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-11"
              disabled={isPending || items.length === 0}
              onClick={saveAndExit}
            >
              Guardar y seguir luego
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              disabled={isPending}
              onClick={() => setCancelOpen(true)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar este conteo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Lo que llevas no se guarda. El inventario queda exactamente como
            está. Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setCancelOpen(false)}
              disabled={isPending}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={isPending}
              onClick={doCancel}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
