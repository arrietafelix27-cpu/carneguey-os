"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Banknote,
  CreditCard,
  ArrowLeftRight,
  Wallet,
  Receipt,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { formatCOP, formatKg, formatQty } from "@/lib/format";
import { SaleAdjustmentDialog } from "@/components/shared/sale-adjustment-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SaleItemRow = {
  id: string;
  productName: string;
  unit: "kg" | "unit";
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type SaleRow = {
  id: string;
  createdAt: string;
  paymentMethod: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  status: string;
  items: SaleItemRow[];
};

const METHODS = ["cash", "card", "transfer", "credit"] as const;

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "A crédito",
};

const METHOD_ICON: Record<string, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
  credit: Wallet,
};

function qtyLabel(item: SaleItemRow): string {
  return item.unit === "kg"
    ? `${formatKg(item.quantity)} kg`
    : `${formatQty(item.quantity)} und`;
}

export function VentasDiaView({ sales }: { sales: SaleRow[] }) {
  const [active, setActive] = useState<SaleRow | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);

  const totals = useMemo(() => {
    const byMethod: Record<string, number> = {
      cash: 0,
      card: 0,
      transfer: 0,
      credit: 0,
    };
    let grand = 0;
    for (const s of sales) {
      byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.total;
      grand += s.total;
    }
    return { byMethod, grand };
  }, [sales]);

  return (
    <div>
      <div className="mb-5 rounded-3xl bg-primary px-6 py-7 text-center shadow-[var(--shadow-brand)]">
        <p className="text-[13px] font-medium uppercase tracking-wide text-primary-foreground/80">
          Total facturado hoy
        </p>
        <p className="mt-1 text-[38px] font-bold leading-tight tracking-tight text-primary-foreground tabular-nums">
          {formatCOP(totals.grand)}
        </p>
        <p className="mt-1 text-[13px] text-primary-foreground/80">
          {sales.length} {sales.length === 1 ? "venta" : "ventas"}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        {METHODS.map((m) => {
          const Icon = METHOD_ICON[m];
          return (
            <div key={m} className="rounded-2xl bg-card px-4 py-3.5 shadow-sm">
              <div className="mb-1.5 flex items-center gap-1.5 text-secondary-foreground">
                <Icon className="size-4" />
                <span className="text-[12px] font-medium">
                  {METHOD_LABEL[m]}
                </span>
              </div>
              <p className="text-[17px] font-bold tabular-nums text-foreground">
                {formatCOP(totals.byMethod[m] ?? 0)}
              </p>
            </div>
          );
        })}
      </div>

      <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Ventas
      </h2>

      {sales.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
          Todavía no hay ventas hoy.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {sales.map((s, i) => (
            <li
              key={s.id}
              className={i > 0 ? "border-t border-border" : undefined}
            >
              <button
                onClick={() => setActive(s)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-secondary"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-red-soft)] text-primary">
                  <Receipt className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-medium text-foreground">
                    {format(new Date(s.createdAt), "HH:mm")}
                    {s.status === "credit_pending" && (
                      <span className="text-[12px] font-normal text-warning">
                        pendiente
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[13px] text-secondary-foreground">
                    {s.items.length}{" "}
                    {s.items.length === 1 ? "producto" : "productos"} ·{" "}
                    {METHOD_LABEL[s.paymentMethod]}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-foreground tabular-nums">
                  {formatCOP(s.total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Venta · {active ? format(new Date(active.createdAt), "HH:mm") : ""}
            </DialogTitle>
          </DialogHeader>

          {active && (
            <div className="grid gap-4">
              <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-secondary">
                {active.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-foreground">
                        {it.productName}
                      </span>
                      <span className="block text-[12px] text-secondary-foreground">
                        {qtyLabel(it)} × {formatCOP(it.unitPrice)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">
                      {formatCOP(it.totalPrice)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="grid gap-1.5 rounded-2xl bg-secondary px-4 py-3 text-[14px]">
                <div className="flex items-center justify-between text-secondary-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {formatCOP(active.subtotal)}
                  </span>
                </div>
                {active.discountTotal > 0 && (
                  <div className="flex items-center justify-between text-secondary-foreground">
                    <span>Descuento</span>
                    <span className="tabular-nums">
                      -{formatCOP(active.discountTotal)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold text-foreground">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatCOP(active.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-secondary-foreground">
                  <span>Método</span>
                  <span>{METHOD_LABEL[active.paymentMethod]}</span>
                </div>
              </div>

              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={() => {
                  setAdjusting(active.id);
                  setActive(null);
                }}
              >
                <PenLine className="size-4" />
                Corregir esta venta
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SaleAdjustmentDialog
        saleId={adjusting}
        open={adjusting !== null}
        onOpenChange={(o) => !o && setAdjusting(null)}
      />
    </div>
  );
}
