"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER, type Category } from "@/lib/catalog";
import { formatQty } from "@/lib/format";
import {
  saveActualsQuincenal,
  finalizeQuincenalCount,
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

export type PhysicalItem = {
  id: string;
  product_name: string;
  category: Category;
  unit: "kg" | "unit";
  theoretical: number;
  sold: number;
  initialActual: string;
};

function actualNumber(s: string): number | null {
  const v = s.trim();
  if (v === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

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

export function ConteoPhysicalEditor({
  countId,
  initialItems,
}: {
  countId: string;
  initialItems: PhysicalItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(
    initialItems.map((it) => ({ ...it, actual: it.initialActual })),
  );
  const [query, setQuery] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function setActual(id: string, value: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, actual: value } : it)),
    );
  }

  function payload() {
    return items.map((it) => ({ item_id: it.id, actual: it.actual.trim() }));
  }

  function goBackToSales() {
    startTransition(async () => {
      const r = await saveActualsQuincenal(countId, payload());
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.push("/admin/conteo/nuevo?paso=ventas");
    });
  }

  function doFinalize() {
    startTransition(async () => {
      const save = await saveActualsQuincenal(countId, payload());
      if ("error" in save) {
        toast.error(save.error);
        return;
      }
      const fin = await finalizeQuincenalCount(countId);
      if ("error" in fin) {
        toast.error(fin.error);
        return;
      }
      toast.success("Conteo finalizado. Inventario actualizado.");
      setFinalizeOpen(false);
      router.push(`/admin/conteos/${countId}`);
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

  const counts = useMemo(() => {
    let counted = 0;
    let green = 0;
    let yellow = 0;
    let red = 0;
    for (const it of items) {
      const a = actualNumber(it.actual);
      if (a === null) continue;
      counted += 1;
      const shouldBe = it.theoretical - (it.sold ?? 0);
      const b = bandFor(a - shouldBe, shouldBe);
      if (b === "green") green += 1;
      else if (b === "yellow") yellow += 1;
      else red += 1;
    }
    return { counted, green, yellow, red, total: items.length };
  }, [items]);

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
      <div className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Paso 2 de 2
        </p>
        <h2 className="text-xl font-bold text-foreground">
          Conteo físico real
        </h2>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {counts.counted} de {counts.total} contados ·{" "}
          <span className="text-success">{counts.green} OK</span> ·{" "}
          <span className="text-warning">{counts.yellow} mod.</span> ·{" "}
          <span className="text-danger">{counts.red} alta</span>
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl bg-card shadow-sm px-6 py-16 text-center text-sm text-muted-foreground">
          No hay productos para contar.
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
                    const shouldBe =
                      Math.round((it.theoretical - (it.sold ?? 0)) * 100) /
                      100;
                    const a = actualNumber(it.actual);
                    const diff =
                      a === null
                        ? null
                        : Math.round((a - shouldBe) * 100) / 100;
                    const band =
                      diff === null ? null : bandFor(diff, shouldBe);
                    const style = band ? BAND_STYLES[band] : null;
                    return (
                      <li
                        key={it.id}
                        className={`px-5 py-3.5 ${
                          i > 0 ? "border-t border-border/60" : ""
                        }`}
                      >
                        <p className="truncate text-[15px] font-medium text-foreground">
                          {it.product_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground tabular-nums">
                          Había {formatQty(it.theoretical)} {u} · Vendido{" "}
                          {formatQty(it.sold)} {u} · Debe haber{" "}
                          <span className="font-semibold text-foreground">
                            {formatQty(shouldBe)} {u}
                          </span>
                        </p>
                        <div className="mt-2 grid grid-cols-[1fr_auto] items-stretch gap-3">
                          <Input
                            inputMode={
                              it.unit === "unit" ? "numeric" : "decimal"
                            }
                            placeholder="¿Cuánto hay?"
                            value={it.actual}
                            onChange={(e) => setActual(it.id, e.target.value)}
                            className="text-right"
                          />
                          {style && diff !== null ? (
                            <div
                              className={`grid min-w-[6.5rem] place-items-center rounded-xl px-3 ${style.bg}`}
                            >
                              <p
                                className={`text-xs font-semibold tabular-nums ${style.text}`}
                              >
                                {diff > 0 ? "+" : ""}
                                {formatQty(diff)} {u}
                              </p>
                            </div>
                          ) : (
                            <div className="grid min-w-[6.5rem] place-items-center rounded-xl bg-secondary px-3 text-xs text-muted-foreground">
                              —
                            </div>
                          )}
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
            disabled={isPending || counts.counted === 0}
            onClick={() => setFinalizeOpen(true)}
          >
            Finalizar conteo
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-11"
              disabled={isPending}
              onClick={goBackToSales}
            >
              Volver a ventas
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

      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar conteo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            El inventario de cada producto va a quedar exactamente con lo que
            pusiste en &ldquo;¿Cuánto hay en realidad?&rdquo;.{" "}
            {counts.counted}{" "}
            {counts.counted === 1 ? "producto contado" : "productos contados"}.
            Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setFinalizeOpen(false)}
              disabled={isPending}
            >
              Volver
            </Button>
            <Button
              className="gap-2"
              disabled={isPending}
              onClick={doFinalize}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
