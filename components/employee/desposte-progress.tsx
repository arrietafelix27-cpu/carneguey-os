"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Trash2, Check } from "lucide-react";
import type { Product } from "@/lib/catalog";
import { formatKg } from "@/lib/format";
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
  weight_kg: number;
};

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const registered = useMemo(
    () => items.reduce((s, it) => s + it.weight_kg, 0),
    [items],
  );
  const remaining = Math.round((inputWeight - registered) * 100) / 100;
  const progress = Math.min(
    100,
    Math.max(0, (registered / inputWeight) * 100),
  );
  const mermaPct = inputWeight > 0 ? (remaining / inputWeight) * 100 : 0;

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function addItem() {
    if (!picked) return;
    startTransition(async () => {
      const result = await addDesposteItem({
        desposte_id: desposteId,
        product_id: picked.id,
        weight_kg: weight,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          id: result.itemId,
          product_id: picked.id,
          product_name: picked.name,
          weight_kg: Number(weight.replace(",", ".")),
        },
      ]);
      setPicked(null);
      setWeight("");
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
      toast.success("Desposte finalizado");
      router.push("/empleado/desposte");
    });
  }

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
              {formatKg(registered)}
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
            <p className="text-xs text-muted-foreground">Restante</p>
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
              onClick={() => {
                setPicked(p);
                setWeight("");
              }}
              className="rounded-xl border border-border bg-card px-3 py-3 text-left text-sm font-medium text-foreground transition-transform active:scale-[0.97]"
            >
              {p.name}
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
                <span className="text-sm font-semibold text-foreground">
                  {formatKg(it.weight_kg)} kg
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

      {/* Dialog: ingresar peso del corte */}
      <Dialog
        open={!!picked}
        onOpenChange={(o) => {
          if (!o) setPicked(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{picked?.name}</DialogTitle>
          </DialogHeader>
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
          <div className="grid gap-2 text-sm">
            <p className="text-muted-foreground">
              Registraste {formatKg(registered)} kg de{" "}
              {formatKg(inputWeight)} kg.
            </p>
            {mermaPct > 10 ? (
              <p className="rounded-md bg-accent px-3 py-2 text-accent-foreground">
                La merma es de {formatKg(remaining)} kg ({mermaPct.toFixed(1)}
                %), que parece alta. ¿Seguro que quieres finalizar?
              </p>
            ) : (
              <p className="text-muted-foreground">
                Merma: {formatKg(remaining)} kg. Una vez finalizado no se
                puede modificar.
              </p>
            )}
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
