"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search } from "lucide-react";
import { formatQty } from "@/lib/format";
import { createSubDesposte } from "@/lib/actions/sub-despostes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type SourceProduct = { id: string; name: string; stock: number };
export type OutputProduct = { id: string; name: string; unit: "kg" | "unit" };

type Row = {
  key: string;
  product_id: string;
  name: string;
  unit: "kg" | "unit";
  weight_kg: number;
  unit_count: number | null;
};

function num(s: string): number {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function SubDesposteForm({
  sources,
  products,
}: {
  sources: SourceProduct[];
  products: OutputProduct[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [sourceId, setSourceId] = useState("");
  const [sourceKg, setSourceKg] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  // Dialog para agregar un producto resultante
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<OutputProduct | null>(null);
  const [weight, setWeight] = useState("");
  const [unitCount, setUnitCount] = useState("");

  const source = sources.find((s) => s.id === sourceId);
  const inputKg = num(sourceKg);
  const outputKg = useMemo(
    () => rows.reduce((s, r) => s + r.weight_kg, 0),
    [rows],
  );
  const merma = Math.round((inputKg - outputKg) * 100) / 100;
  const mermaPct = inputKg > 0 ? (merma / inputKg) * 100 : 0;

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.id !== sourceId && (q === "" || p.name.toLowerCase().includes(q)),
    );
  }, [products, query, sourceId]);

  function addPicked() {
    if (!picked) return;
    const w = num(weight);
    if (w <= 0) {
      toast.error("Ingresa el peso en kg");
      return;
    }
    if (picked.unit === "unit" && num(unitCount) <= 0) {
      toast.error("Ingresa la cantidad en unidades");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        product_id: picked.id,
        name: picked.name,
        unit: picked.unit,
        weight_kg: w,
        unit_count: picked.unit === "unit" ? num(unitCount) : null,
      },
    ]);
    setPickerOpen(false);
    setPicked(null);
    setWeight("");
    setUnitCount("");
    setQuery("");
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function submit() {
    startTransition(async () => {
      const r = await createSubDesposte({
        source_product_id: sourceId,
        source_kg: sourceKg,
        notes,
        items: rows.map((row) => ({
          product_id: row.product_id,
          weight_kg: row.weight_kg,
          unit_count: row.unit_count,
        })),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Sub-desposte registrado. Queda pendiente de aprobación.");
      router.push("/empleado");
    });
  }

  const canSubmit =
    !!sourceId && inputKg > 0 && rows.length > 0 && !isPending;

  return (
    <div className="grid gap-5">
      {/* Origen */}
      <div className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="grid gap-2">
          <Label>Producto de origen</Label>
          <Select value={sourceId} onValueChange={(v) => setSourceId(v ?? "")}>
            <SelectTrigger>
              <span className={source ? "" : "text-text-tertiary"}>
                {source?.name ?? "Elige el producto a transformar"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {formatQty(s.stock)} kg
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 grid gap-2">
          <Label htmlFor="skg">Kg que vas a usar</Label>
          <Input
            id="skg"
            inputMode="decimal"
            placeholder="0,00"
            value={sourceKg}
            onChange={(e) => setSourceKg(e.target.value)}
          />
          {source && (
            <p className="text-[13px] text-secondary-foreground tabular-nums">
              Disponible: {formatQty(source.stock)} kg
            </p>
          )}
        </div>
      </div>

      {/* Contador de merma */}
      {inputKg > 0 && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <Box label="Entró (kg)" value={formatQty(inputKg)} />
          <Box label="Salidas (kg)" value={formatQty(outputKg)} accent />
          <Box
            label="Merma (kg)"
            value={formatQty(merma)}
            danger={merma < 0}
          />
        </div>
      )}

      {/* Productos resultantes */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Productos resultantes ({rows.length})
          </h2>
          {inputKg > 0 && (
            <span className="text-[12px] text-secondary-foreground tabular-nums">
              {mermaPct.toFixed(1)}% merma
            </span>
          )}
        </div>
        {rows.length > 0 && (
          <ul className="mb-3 overflow-hidden rounded-3xl bg-card shadow-sm">
            {rows.map((r, i) => (
              <li
                key={r.key}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="flex-1 text-[15px] font-medium text-foreground">
                  {r.name}
                </span>
                <span className="text-[14px] font-semibold text-foreground tabular-nums">
                  {r.unit === "unit"
                    ? `${formatQty(r.unit_count ?? 0)} u · ${formatQty(r.weight_kg)} kg`
                    : `${formatQty(r.weight_kg)} kg`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(r.key)}
                  aria-label="Quitar"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2"
          disabled={!sourceId}
          onClick={() => {
            setPicked(null);
            setQuery("");
            setWeight("");
            setUnitCount("");
            setPickerOpen(true);
          }}
        >
          <Plus className="size-4" />
          Agregar producto resultante
        </Button>
      </div>

      {/* Nota */}
      <div className="grid gap-2">
        <Label htmlFor="notes">Nota — opcional</Label>
        <Textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button
        className="h-12 w-full gap-2 text-base font-semibold"
        disabled={!canSubmit}
        onClick={submit}
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Registrar sub-desposte
      </Button>

      {/* Selector de producto resultante */}
      <Dialog
        open={pickerOpen}
        onOpenChange={(o) => {
          setPickerOpen(o);
          if (!o) {
            setPicked(null);
            setQuery("");
            setWeight("");
            setUnitCount("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{picked ? picked.name : "Elige el producto"}</DialogTitle>
          </DialogHeader>
          {!picked ? (
            <div className="grid gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar producto"
                  className="pl-9"
                  inputMode="search"
                />
              </div>
              <ul className="max-h-64 overflow-y-auto rounded-2xl bg-secondary">
                {candidates.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => {
                        setPicked(p);
                        setWeight("");
                        setUnitCount("");
                      }}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-[15px] font-medium text-foreground transition-colors active:bg-card"
                    >
                      {p.name}
                      {p.unit === "unit" && (
                        <span className="text-xs text-secondary-foreground">
                          unidades
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {candidates.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-secondary-foreground">
                    Sin coincidencias.
                  </li>
                )}
              </ul>
            </div>
          ) : picked.unit === "unit" ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="uc">Cantidad (unidades)</Label>
                <Input
                  id="uc"
                  inputMode="numeric"
                  placeholder="0"
                  value={unitCount}
                  onChange={(e) => setUnitCount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uw">Peso total (kg)</Label>
                <Input
                  id="uw"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="w">Peso (kg)</Label>
              <Input
                id="w"
                inputMode="decimal"
                placeholder="0,00"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {picked && (
            <DialogFooter>
              <Button variant="secondary" onClick={() => setPicked(null)}>
                Volver
              </Button>
              <Button onClick={addPicked}>Agregar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Box({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card px-3 py-3 shadow-sm">
      <p
        className={`text-[19px] font-bold tabular-nums ${
          danger ? "text-danger" : accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-secondary-foreground">{label}</p>
    </div>
  );
}
