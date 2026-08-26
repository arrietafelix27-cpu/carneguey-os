"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowDown } from "lucide-react";
import { formatQty } from "@/lib/format";
import { createCutTransfer } from "@/lib/actions/transfers";
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

export type TransferProduct = {
  id: string;
  name: string;
  stock: number;
};

export function CutTransferForm({
  products,
}: {
  products: TransferProduct[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sourceId, setSourceId] = useState("");
  const [destId, setDestId] = useState("");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");

  const source = products.find((p) => p.id === sourceId);
  const dest = products.find((p) => p.id === destId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createCutTransfer({
        source_product_id: sourceId,
        dest_product_id: destId,
        quantity_kg: qty,
        notes,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.applied
          ? "Transferencia aplicada al inventario."
          : "Transferencia registrada. Queda pendiente de aprobación.",
      );
      router.push("/empleado");
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="grid gap-2">
          <Label>Sale de (origen)</Label>
          <Select value={sourceId} onValueChange={(v) => setSourceId(v ?? "")}>
            <SelectTrigger>
              <span className={source ? "" : "text-text-tertiary"}>
                {source?.name ?? "Elige el corte de origen"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {formatQty(p.stock)} kg
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {source && (
            <p className="text-[13px] text-secondary-foreground tabular-nums">
              Disponible: {formatQty(source.stock)} kg
            </p>
          )}
        </div>

        <div className="my-3 flex justify-center">
          <span className="grid size-9 place-items-center rounded-full bg-[var(--brand-red-soft)] text-primary">
            <ArrowDown className="size-5" />
          </span>
        </div>

        <div className="grid gap-2">
          <Label>Entra a (destino)</Label>
          <Select value={destId} onValueChange={(v) => setDestId(v ?? "")}>
            <SelectTrigger>
              <span className={dest ? "" : "text-text-tertiary"}>
                {dest?.name ?? "Elige el corte de destino"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {products
                .filter((p) => p.id !== sourceId)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="qty">Cantidad a transferir (kg)</Label>
        <Input
          id="qty"
          inputMode="decimal"
          placeholder="0,00"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <p className="text-[13px] text-secondary-foreground">
          Salen exactamente los mismos kg del origen que entran al destino.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Nota (por qué) — opcional</Label>
        <Textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej: se acabó la masa pierna, se vendió palomilla en su lugar"
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full gap-2 text-base font-semibold"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Registrar transferencia
      </Button>
    </form>
  );
}
