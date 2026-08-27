"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Search, Receipt, TriangleAlert, PenLine } from "lucide-react";
import { formatCOP, formatKg, formatQty } from "@/lib/format";
import { SaleAdjustmentDialog } from "@/components/shared/sale-adjustment-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  customerName: string | null;
  items: SaleItemRow[];
};

export type CustomerOption = { id: string; name: string };

export type SaleFilters = {
  from: string;
  to: string;
  customerId: string;
  method: string;
  q: string;
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "A crédito",
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  completed: { label: "Completada", className: "text-success" },
  credit_pending: { label: "Crédito pendiente", className: "text-warning" },
  returned: {
    label: "Devuelta",
    className: "text-secondary-foreground",
  },
  cancelled: { label: "Cancelada", className: "text-danger" },
};

function qtyLabel(item: SaleItemRow): string {
  return item.unit === "kg"
    ? `${formatKg(item.quantity)} kg`
    : `${formatQty(item.quantity)} und`;
}

export function VentasHistoryManager({
  sales,
  customers,
  truncated,
  filters,
}: {
  sales: SaleRow[];
  customers: CustomerOption[];
  truncated: boolean;
  filters: SaleFilters;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [customerId, setCustomerId] = useState(filters.customerId);
  const [method, setMethod] = useState(filters.method);
  const [q, setQ] = useState(filters.q);
  const [active, setActive] = useState<SaleRow | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);

  const summary = useMemo(() => {
    const byMethod: Record<string, number> = {
      cash: 0,
      card: 0,
      transfer: 0,
      credit: 0,
    };
    let total = 0;
    let count = 0;
    for (const s of sales) {
      if (s.status === "cancelled") continue;
      byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.total;
      total += s.total;
      count += 1;
    }
    return { byMethod, total, count };
  }, [sales]);

  function applyFilters() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (customerId) params.set("customer_id", customerId);
    if (method) params.set("method", method);
    if (q.trim()) params.set("q", q.trim());
    router.push(`/admin/ventas?${params.toString()}`);
  }

  function clearFilters() {
    setCustomerId("");
    setMethod("");
    setQ("");
    router.push("/admin/ventas");
  }

  return (
    <div>
      {/* Filtros */}
      <div className="mb-5 grid grid-cols-2 gap-3 rounded-3xl bg-card p-4 shadow-sm">
        <div className="grid gap-1.5">
          <Label htmlFor="from">Desde</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to">Hasta</Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="q">Producto</Label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre del producto"
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Cliente</Label>
          <Select
            value={customerId || "all"}
            onValueChange={(v) => setCustomerId(v === "all" ? "" : (v ?? ""))}
          >
            <SelectTrigger>
              <span>
                {customerId
                  ? customers.find((c) => c.id === customerId)?.name ??
                    "Cliente"
                  : "Todos"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>Método</Label>
          <Select
            value={method || "all"}
            onValueChange={(v) => setMethod(v === "all" ? "" : (v ?? ""))}
          >
            <SelectTrigger>
              <span>{method ? METHOD_LABEL[method] : "Todos"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="cash">Efectivo</SelectItem>
              <SelectItem value="card">Tarjeta</SelectItem>
              <SelectItem value="transfer">Transferencia</SelectItem>
              <SelectItem value="credit">A crédito</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 flex gap-2 pt-1">
          <Button variant="secondary" className="flex-1" onClick={clearFilters}>
            Limpiar
          </Button>
          <Button className="flex-1" onClick={applyFilters}>
            Filtrar
          </Button>
        </div>
      </div>

      {truncated && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-warning/15 px-4 py-2.5 text-[13px] text-warning">
          <TriangleAlert className="size-4 shrink-0" />
          Hay más de 500 ventas en este período — angosta el rango de fechas
          para ver todas.
        </div>
      )}

      {/* Resumen */}
      <div className="mb-5 rounded-3xl bg-primary px-6 py-6 text-center shadow-[var(--shadow-brand)]">
        <p className="text-[13px] font-medium uppercase tracking-wide text-primary-foreground/80">
          Total del período
        </p>
        <p className="mt-1 text-[32px] font-bold leading-tight tracking-tight text-primary-foreground tabular-nums">
          {formatCOP(summary.total)}
        </p>
        <p className="mt-1 text-[13px] text-primary-foreground/80">
          {summary.count} {summary.count === 1 ? "transacción" : "transacciones"}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["cash", "card", "transfer", "credit"] as const).map((m) => (
          <div key={m} className="rounded-2xl bg-card px-4 py-3.5 shadow-sm">
            <p className="mb-1 text-[12px] font-medium text-secondary-foreground">
              {METHOD_LABEL[m]}
            </p>
            <p className="text-[16px] font-bold tabular-nums text-foreground">
              {formatCOP(summary.byMethod[m] ?? 0)}
            </p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {sales.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
          No hay ventas con estos filtros.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {sales.map((s, i) => {
            const meta = STATUS_META[s.status] ?? {
              label: s.status,
              className: "text-secondary-foreground",
            };
            return (
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
                    <span className="block truncate text-[15px] font-medium text-foreground">
                      {format(new Date(s.createdAt), "dd/MM/yyyy HH:mm")}
                      {s.customerName ? ` · ${s.customerName}` : ""}
                    </span>
                    <span className="block truncate text-[13px] text-secondary-foreground">
                      {METHOD_LABEL[s.paymentMethod]} ·{" "}
                      <span className={meta.className}>{meta.label}</span>
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-foreground tabular-nums">
                    {formatCOP(s.total)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Venta ·{" "}
              {active ? format(new Date(active.createdAt), "dd/MM/yyyy HH:mm") : ""}
            </DialogTitle>
          </DialogHeader>

          {active && (
            <div className="grid gap-4">
              {active.customerName && (
                <p className="text-[14px] text-secondary-foreground">
                  Cliente: <span className="text-foreground">{active.customerName}</span>
                </p>
              )}

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
                <div className="flex items-center justify-between text-secondary-foreground">
                  <span>Estado</span>
                  <span
                    className={
                      (STATUS_META[active.status] ?? {
                        className: "text-secondary-foreground",
                      }).className
                    }
                  >
                    {(STATUS_META[active.status] ?? { label: active.status })
                      .label}
                  </span>
                </div>
              </div>

              {active.status !== "cancelled" && (
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
              )}
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
