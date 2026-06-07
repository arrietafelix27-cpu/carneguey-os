"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Trash2, Check } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { formatKg, formatQty } from "@/lib/format";
import {
  addDesposteItem,
  removeDesposteItem,
  finalizeDesposte,
} from "@/lib/actions/desposte";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type DesposteItem = {
  id: string;
  product_id: string;
  product_name: string;
  product_unit: "kg" | "unit";
  /** Peso real en kg del corte. Para productos unit son los kg que pesan
   *  las unidades en total — descuentan del lote. */
  weight_kg: number;
  /** Para productos unit: cuántas unidades salieron. Null para productos kg
   *  o para datos creados antes de la migración 010. */
  unit_count: number | null;
};

// Normaliza tildes y acentos para que "higado" encuentre "Hígado".
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function displayItemAmount(it: DesposteItem): string {
  if (it.product_unit === "unit") {
    if (it.unit_count !== null) {
      return `${formatQty(it.unit_count)} u · ${formatKg(it.weight_kg)} kg`;
    }
    // Dato viejo (antes de migración 010): weight_kg guardaba la cantidad.
    return `${formatQty(it.weight_kg)} u`;
  }
  return `${formatKg(it.weight_kg)} kg`;
}

export function DesposteProgress({
  desposteId,
  lotCode,
  inputWeight,
  products,
  initialItems,
}: {
  desposteId: string;
  lotCode: string;
  inputWeight: number;
  products: Product[];
  initialItems: DesposteItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<DesposteItem[]>(initialItems);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [weight, setWeight] = useState("");
  const [unitCount, setUnitCount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Suma kg de todos los cortes. Para productos unit ahora weight_kg son los
  // kg reales y deben descontarse del lote. Los datos viejos (unit_count
  // null en productos unit) se saltan para no contaminar el contador.
  const registeredKg = useMemo(
    () =>
      items.reduce((s, it) => {
        if (it.product_unit === "unit" && it.unit_count === null) return s;
        return s + it.weight_kg;
      }, 0),
    [items],
  );
  const remaining = Math.round((inputWeight - registeredKg) * 100) / 100;
  const progress = Math.min(
    100,
    Math.max(0, (registeredKg / inputWeight) * 100),
  );
  const mermaPct = inputWeight > 0 ? (remaining / inputWeight) * 100 : 0;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return products;
    return products.filter((p) => normalize(p.name).includes(q));
  }, [products, query]);

  function openPick(p: Product) {
    setPicked(p);
    setWeight("");
    setUnitCount("");
  }

  function addItem() {
    if (!picked) return;
    const isUnit = picked.unit === "unit";
    startTransition(async () => {
      const result = await addDesposteItem({
        desposte_id: desposteId,
        product_id: picked.id,
        weight_kg: weight,
        unit_count: isUnit ? unitCount : null,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const parsedWeight = Number(weight.replace(",", "."));
      const parsedUnitCount = isUnit ? Number(unitCount.replace(",", ".")) : 0;
      setItems((prev) => [
        ...prev,
        {
          id: result.itemId,
          product_id: picked.id,
          product_name: picked.name,
          product_unit: picked.unit,
          weight_kg: parsedWeight,
          unit_count: isUnit ? parsedUnitCount : null,
        },
      ]);
      setPicked(null);
      setWeight("");
      setUnitCount("");
    });
  }

  function removeItem(itemId: string) {
    startTransition(async () => {
      const result = await removeDesposteItem(itemId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== itemId));
    });
  }

  function finalize() {
    startTransition(async () => {
      const result = await finalizeDesposte(desposteId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Desposte finalizado · Merma ${formatKg(remaining)} kg`);
      setConfirmOpen(false);
      router.push("/empleado/desposte");
    });
  }

  const pickedUnit: "kg" | "unit" = picked?.unit === "unit" ? "unit" : "kg";

  return (
    <div className="grid gap-5">
      {/* Encabezado con contador en vivo */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Desposte · {lotCode}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">
              {formatKg(inputWeight)}
            </p>
            <p className="text-xs text-muted-foreground">Entró (kg)</p>
          </div>
          <div>
            <p className="text-lg font-bold text-primary">
              {formatKg(registeredKg)}
            </p>
            <p className="text-xs text-muted-foreground">Registrado</p>
          </div>
          <div>
            <p
              className={`text-lg font-bold ${
                remaining < 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {formatKg(remaining)}
            </p>
            <p className="text-xs text-muted-foreground">Merma potencial</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Buscador + productos */}
      <div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar corte"
            className="pl-9"
            inputMode="search"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => openPick(p)}
              className="rounded-xl border border-border bg-card px-3 py-3 text-left text-sm font-medium text-foreground transition-transform active:scale-[0.97]"
            >
              {p.name}
              {p.unit === "unit" && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  · u
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cortes registrados */}
      {items.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cortes registrados ({items.length})
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 font-medium text-foreground">
                  {it.product_name}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {displayItemAmount(it)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => removeItem(it.id)}
                  aria-label="Quitar corte"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        className="h-12 w-full text-base font-semibold"
        disabled={isPending || items.length === 0}
        onClick={() => setConfirmOpen(true)}
      >
        Finalizar desposte
      </Button>

      {/* Dialog: ingresar cantidad del corte */}
      <Dialog
        open={!!picked}
        onOpenChange={(o) => {
          if (!o) {
            setPicked(null);
            setWeight("");
            setUnitCount("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{picked?.name}</DialogTitle>
          </DialogHeader>
          {pickedUnit === "unit" ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cu">Cantidad (unidades)</Label>
                <Input
                  id="cu"
                  inputMode="numeric"
                  placeholder="0"
                  value={unitCount}
                  onChange={(e) => setUnitCount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cw">Peso total (kg)</Label>
                <Input
                  id="cw"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Las unidades entran al inventario; los kg descuentan del
                  lote.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="cw">Peso del corte (kg)</Label>
              <Input
                id="cw"
                inputMode="decimal"
                placeholder="0,00"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <DialogFooter>
            <Button
              className="gap-2"
              disabled={isPending}
              onClick={addItem}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar finalización */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar desposte</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <p className="text-muted-foreground">
              Registraste {formatKg(registeredKg)} kg de{" "}
              {formatKg(inputWeight)} kg que entraron.
            </p>
            <div className="rounded-xl bg-secondary px-4 py-3 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Merma
              </p>
              <p className="text-3xl font-bold text-foreground">
                {formatKg(remaining)} kg
              </p>
              <p className="text-xs text-muted-foreground">
                {mermaPct.toFixed(1)}% del peso que entró
              </p>
            </div>
            {mermaPct > 10 && (
              <p className="rounded-md bg-accent px-3 py-2 text-accent-foreground">
                La merma parece alta. ¿Seguro que quieres finalizar?
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Una vez finalizado no se puede modificar.
            </p>
          </div>
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
