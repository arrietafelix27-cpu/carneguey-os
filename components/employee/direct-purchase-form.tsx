"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Product, Provider } from "@/lib/catalog";
import { createDirectPurchase } from "@/lib/actions/direct-purchases";
import { PaymentMethodField } from "@/components/shared/payment-method-field";
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

const today = () => new Date().toISOString().slice(0, 10);

type Row = { product_id: string; quantity: string; total_cost: string };

const emptyRow = (): Row => ({ product_id: "", quantity: "", total_cost: "" });

export function DirectPurchaseForm({
  providers,
  products,
}: {
  providers: Provider[];
  products: Product[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [providerId, setProviderId] = useState("");
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">(
    "cash",
  );
  const [dueDate, setDueDate] = useState("");

  const selectedProvider = providers.find((p) => p.id === providerId);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createDirectPurchase({
        provider_id: providerId,
        purchase_date: date,
        notes,
        items: rows.map((r) => ({
          product_id: r.product_id,
          quantity: r.quantity,
          total_cost: r.total_cost,
        })),
        payment_method: paymentMethod,
        due_date: paymentMethod === "credit" ? dueDate : "",
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Compra registrada");
      router.push("/empleado/compras");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <Label>Proveedor</Label>
        <Select
          value={providerId}
          onValueChange={(v) => setProviderId(v ?? "")}
        >
          <SelectTrigger>
            <span className={selectedProvider ? "" : "text-muted-foreground"}>
              {selectedProvider?.name ?? "Selecciona un proveedor"}
            </span>
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="date">Fecha de compra</Label>
        <Input
          id="date"
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        <Label>Productos</Label>
        {rows.map((row, i) => {
          const product = products.find((p) => p.id === row.product_id);
          const unitLabel = product?.unit === "unit" ? "unidades" : "kg";
          return (
            <div
              key={i}
              className="grid gap-3 rounded-2xl bg-card shadow-sm p-3"
            >
              <div className="flex items-center gap-2">
                <Select
                  value={row.product_id}
                  onValueChange={(v) =>
                    updateRow(i, { product_id: v ?? "" })
                  }
                >
                  <SelectTrigger className="flex-1">
                    <span
                      className={
                        product ? "" : "text-muted-foreground"
                      }
                    >
                      {product?.name ?? "Producto"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(i)}
                    aria-label="Quitar producto"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">
                    Cantidad ({unitLabel})
                  </Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0"
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(i, { quantity: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">
                    Costo total
                  </Label>
                  <Input
                    inputMode="numeric"
                    placeholder="$"
                    value={row.total_cost}
                    onChange={(e) =>
                      updateRow(i, { total_cost: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          onClick={addRow}
          className="gap-2"
        >
          <Plus className="size-4" />
          Agregar otro producto
        </Button>
        <p className="text-xs text-muted-foreground">
          El costo lo necesita Félix. Tú no lo verás después de guardar.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <PaymentMethodField
        value={paymentMethod}
        onChange={setPaymentMethod}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
      />

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full gap-2 text-base font-semibold transition-transform active:scale-[0.98]"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Guardar compra
      </Button>
    </form>
  );
}
