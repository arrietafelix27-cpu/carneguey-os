"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Ban, Undo2, PackageCheck, PackageX } from "lucide-react";
import { formatCOP, formatKg, formatQty } from "@/lib/format";
import {
  getSaleForAdjustment,
  requestSaleAdjustment,
} from "@/lib/actions/sale-adjustments";
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

type SaleDetail = Awaited<ReturnType<typeof getSaleForAdjustment>>;
type Mode = "choose" | "void" | "return";

function qtyLabel(unit: "kg" | "unit", qty: number): string {
  return unit === "kg" ? `${formatKg(qty)} kg` : `${formatQty(qty)} und`;
}

export function SaleAdjustmentDialog({
  saleId,
  open,
  onOpenChange,
}: {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [sale, setSale] = useState<SaleDetail>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [restock, setRestock] = useState(true);
  const [refundMethod, setRefundMethod] = useState<"cash" | "credit_note">(
    "cash",
  );
  const [isPending, startTransition] = useTransition();

  // Carga el detalle cada vez que se abre sobre una venta distinta.
  useEffect(() => {
    if (!open || !saleId) return;
    let cancelled = false;
    setLoading(true);
    setMode("choose");
    setReason("");
    setQuantities({});
    setRestock(true);
    getSaleForAdjustment(saleId).then((d) => {
      if (cancelled) return;
      setSale(d);
      // Si la venta fue a crédito, lo normal es bajarle la deuda.
      setRefundMethod(d?.payment_method === "credit" ? "credit_note" : "cash");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, saleId]);

  const items = sale?.items ?? [];
  const returnable = items.filter(
    (it) => it.quantity - it.returned_qty > 0.0001,
  );

  const returnTotal = returnable.reduce((sum, it) => {
    const q = Number((quantities[it.product_id] ?? "").replace(",", ".")) || 0;
    return sum + Math.round(it.unit_price * q);
  }, 0);

  const hasQuantities = returnTotal > 0;

  const submit = useCallback(() => {
    if (!saleId) return;
    startTransition(async () => {
      const payload =
        mode === "void"
          ? { sale_id: saleId, kind: "void" as const, reason }
          : {
              sale_id: saleId,
              kind: "return" as const,
              reason,
              refund_method: refundMethod,
              restock,
              items: returnable
                .map((it) => ({
                  product_id: it.product_id,
                  quantity:
                    Number(
                      (quantities[it.product_id] ?? "").replace(",", "."),
                    ) || 0,
                }))
                .filter((i) => i.quantity > 0),
            };

      const r = await requestSaleAdjustment(payload);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.applied
          ? r.kind === "void"
            ? "Venta anulada."
            : "Devolución registrada."
          : "Enviado. Queda pendiente de aprobación.",
      );
      onOpenChange(false);
      router.refresh();
    });
  }, [
    saleId,
    mode,
    reason,
    refundMethod,
    restock,
    returnable,
    quantities,
    onOpenChange,
    router,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "choose"
              ? "Corregir venta"
              : mode === "void"
                ? "Anular venta"
                : "Devolver productos"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !sale ? (
          <p className="py-6 text-center text-[15px] text-secondary-foreground">
            No se pudo cargar la venta.
          </p>
        ) : mode === "choose" ? (
          <div className="grid gap-3">
            <button
              type="button"
              disabled={!sale.same_day}
              onClick={() => setMode("void")}
              className="flex items-start gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-left transition-colors active:bg-border disabled:opacity-50"
            >
              <Ban className="mt-0.5 size-5 shrink-0 text-danger" />
              <span>
                <span className="block text-[15px] font-semibold text-foreground">
                  Anular la venta
                </span>
                <span className="block text-[13px] leading-snug text-secondary-foreground">
                  {sale.same_day
                    ? "No debió existir: se cobró mal o por error. Todo vuelve al inventario."
                    : "Solo se puede anular el mismo día. Para esta venta, usa una devolución."}
                </span>
              </span>
            </button>

            <button
              type="button"
              disabled={returnable.length === 0}
              onClick={() => setMode("return")}
              className="flex items-start gap-3 rounded-2xl bg-secondary px-4 py-3.5 text-left transition-colors active:bg-border disabled:opacity-50"
            >
              <Undo2 className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <span className="block text-[15px] font-semibold text-foreground">
                  Devolver productos
                </span>
                <span className="block text-[13px] leading-snug text-secondary-foreground">
                  {returnable.length === 0
                    ? "Ya se devolvió todo lo de esta venta."
                    : "El cliente trajo algo de vuelta. Puedes devolver solo una parte."}
                </span>
              </span>
            </button>
          </div>
        ) : mode === "void" ? (
          <div className="grid gap-4">
            <div className="rounded-2xl bg-danger/10 px-4 py-3">
              <p className="text-[14px] leading-snug text-foreground">
                Se anulará la venta completa por{" "}
                <span className="font-semibold">{formatCOP(sale.total)}</span>.
                Los productos vuelven al inventario y la venta sale del cuadre
                del día.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="void-reason">¿Por qué? (opcional)</Label>
              <Input
                id="void-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Se cobró dos veces"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>¿Cuánto devuelve de cada producto?</Label>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-secondary">
                {returnable.map((it) => {
                  const available = it.quantity - it.returned_qty;
                  return (
                    <li key={it.product_id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-foreground">
                            {it.name}
                          </span>
                          <span className="block text-[12px] text-secondary-foreground">
                            se puede devolver {qtyLabel(it.unit, available)} ·{" "}
                            {formatCOP(it.unit_price)}
                            {it.unit === "kg" ? "/kg" : " c/u"}
                          </span>
                        </span>
                        <Input
                          inputMode={it.unit === "kg" ? "decimal" : "numeric"}
                          value={quantities[it.product_id] ?? ""}
                          onChange={(e) =>
                            setQuantities((prev) => ({
                              ...prev,
                              [it.product_id]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="h-10 w-24 shrink-0 text-right"
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="grid gap-2">
              <Label>¿El producto vuelve al inventario?</Label>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceButton
                  active={restock}
                  onClick={() => setRestock(true)}
                  icon={<PackageCheck className="size-4" />}
                  label="Sí, vuelve"
                  hint="Está bueno, se puede vender"
                />
                <ChoiceButton
                  active={!restock}
                  onClick={() => setRestock(false)}
                  icon={<PackageX className="size-4" />}
                  label="Se pierde"
                  hint="Dañado, no se revende"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>¿Cómo se le devuelve la plata?</Label>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceButton
                  active={refundMethod === "cash"}
                  onClick={() => setRefundMethod("cash")}
                  label="Efectivo"
                  hint="Sale de la caja de hoy"
                />
                <ChoiceButton
                  active={refundMethod === "credit_note"}
                  onClick={() => setRefundMethod("credit_note")}
                  disabled={!sale.customer_id}
                  label="Bajar la deuda"
                  hint={
                    sale.customer_id
                      ? "Le queda debiendo menos"
                      : "Esta venta no tiene cliente"
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ret-reason">¿Por qué? (opcional)</Label>
              <Input
                id="ret-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="El pollo venía con mal olor"
              />
            </div>

            {hasQuantities && (
              <div className="flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
                <span className="text-[14px] text-secondary-foreground">
                  Total a devolver
                </span>
                <span className="text-[17px] font-bold tabular-nums text-foreground">
                  {formatCOP(returnTotal)}
                </span>
              </div>
            )}
          </div>
        )}

        {mode !== "choose" && !loading && sale && (
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMode("choose")}>
              Atrás
            </Button>
            <Button
              className="gap-2"
              disabled={isPending || (mode === "return" && !hasQuantities)}
              onClick={submit}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {mode === "void" ? "Anular venta" : "Registrar devolución"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChoiceButton({
  active,
  onClick,
  label,
  hint,
  icon,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-2xl px-3 py-2.5 text-left transition-colors disabled:opacity-40 ${
        active
          ? "bg-[var(--brand-red-soft)] text-primary"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[14px] font-semibold">
        {icon}
        {label}
      </span>
      <span className="mt-0.5 block text-[12px] leading-snug opacity-80">
        {hint}
      </span>
    </button>
  );
}
