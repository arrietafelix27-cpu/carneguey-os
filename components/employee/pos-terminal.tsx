"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  ScanLine,
  Trash2,
  Loader2,
  Monitor,
  ChevronDown,
  RotateCcw,
  Check,
  User,
} from "lucide-react";
import { formatCOP } from "@/lib/format";
import { completeSale } from "@/lib/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type PosProduct = {
  id: string;
  pos_code: string;
  name: string;
  unit: "kg" | "unit";
  price: number;
};

export type PosCustomer = {
  id: string;
  name: string;
  discount_type: "percentage" | "fixed_per_product" | null;
  discount_value: number;
};

type CartItem = {
  key: string;
  productId: string;
  name: string;
  unit: "kg" | "unit";
  quantity: number; // kg o unidades
  unitPrice: number; // precio ORIGINAL (sin descuento)
};

type PayMethod = "cash" | "card" | "transfer" | "credit";

const PAY_LABELS: Record<PayMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "A crédito",
};

type InvoiceLine = {
  name: string;
  qtyLabel: string;
  unitPrice: number;
  discount: number;
  total: number;
};

type Invoice = {
  saleId: string;
  date: Date;
  customerName: string | null;
  method: PayMethod;
  lines: InvoiceLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  received: number;
  change: number;
};

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Precio unitario ya con el descuento del cliente aplicado. */
function discountedUnit(price: number, customer: PosCustomer | null): number {
  if (!customer || !customer.discount_type || customer.discount_value <= 0) {
    return price;
  }
  return customer.discount_type === "percentage"
    ? price * (1 - customer.discount_value / 100)
    : Math.max(0, price - customer.discount_value);
}

function lineOf(item: CartItem, customer: PosCustomer | null) {
  const origTotal = Math.round(item.unitPrice * item.quantity);
  const unit = discountedUnit(item.unitPrice, customer);
  const total = Math.round(unit * item.quantity);
  return {
    origTotal,
    unit: Math.round(unit),
    total,
    discount: origTotal - total,
  };
}

function qtyLabel(it: { unit: "kg" | "unit"; quantity: number }): string {
  return it.unit === "kg"
    ? `${it.quantity.toFixed(3)} kg`
    : `${it.quantity} u`;
}

export function PosTerminal({
  products,
  customers,
}: {
  products: PosProduct[];
  customers: PosCustomer[];
}) {
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const cache = useMemo(() => {
    const m = new Map<string, PosProduct>();
    for (const p of products) m.set(p.pos_code, p);
    return m;
  }, [products]);

  const [items, setItems] = useState<CartItem[]>([]);
  const [method, setMethod] = useState<PayMethod>("cash");
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [received, setReceived] = useState("");
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeValue, setChangeValue] = useState(0);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isPending, startTransition] = useTransition();

  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanFocused, setScanFocused] = useState(false);

  const [manualProduct, setManualProduct] = useState<PosProduct | null>(null);
  const [manualQty, setManualQty] = useState("");

  // --- Totales con descuento ---
  const totals = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let total = 0;
    for (const it of items) {
      const l = lineOf(it, customer);
      subtotal += l.origTotal;
      discountTotal += l.discount;
      total += l.total;
    }
    return { subtotal, discountTotal, total };
  }, [items, customer]);

  const totalKg = useMemo(
    () => items.reduce((s, it) => s + (it.unit === "kg" ? it.quantity : 0), 0),
    [items],
  );
  const receivedNum = Number(digitsOnly(received) || "0");
  const change = receivedNum - totals.total;

  const focusScan = useCallback(() => {
    if (changeOpen) return;
    scanRef.current?.focus();
  }, [changeOpen]);

  useEffect(() => {
    if (!mounted || !isDesktop) return;
    focusScan();
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("input, textarea, button, [role='menu'], [role='dialog']"))
        return;
      focusScan();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mounted, isDesktop, focusScan]);

  // Si se quita el cliente, "A crédito" deja de ser válido.
  useEffect(() => {
    if (!customer && method === "credit") setMethod("cash");
  }, [customer, method]);

  const pushItem = useCallback((product: PosProduct, quantity: number) => {
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        productId: product.id,
        name: product.name,
        unit: product.unit,
        quantity,
        unitPrice: product.price,
      },
    ]);
  }, []);

  // EAN-13 de la báscula DIBAL: prefijo '2' + pos_code (6 díg, posiciones 2-7)
  // + peso en diezmilésimas de kg (6 díg, posiciones 8-13).
  // Ej: "2 000302 004452" → pos_code 302, peso 4452/10000 = 0,4452 kg.
  const addScan = useCallback(
    (raw: string) => {
      const code = digitsOnly(raw);
      if (code.length < 7) return;
      const posCode = String(parseInt(code.slice(1, 7) || "0", 10));
      const weightRaw = parseInt(code.slice(7, 13) || "0", 10);
      const kg = Math.round((weightRaw / 10000) * 1000) / 1000;

      const product = cache.get(posCode);
      if (!product) {
        toast.error(`Producto no encontrado (código ${posCode})`);
        return;
      }
      pushItem(product, product.unit === "unit" ? 1 : kg);
    },
    [cache, pushItem],
  );

  const openManual = useCallback(
    (raw: string) => {
      const posCode = String(parseInt(digitsOnly(raw) || "0", 10));
      const product = cache.get(posCode);
      if (!product) {
        toast.error(`Producto no encontrado (código ${posCode})`);
        return;
      }
      setManualQty("");
      setManualProduct(product);
    },
    [cache],
  );

  function onScanKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = scanValue;
      setScanValue("");
      const d = digitsOnly(v);
      if (d.length === 0) return;
      if (d.length >= 11) addScan(v);
      else openManual(v);
    }
  }

  const manualQtyNum = (() => {
    const n = Number(manualQty.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  })();
  const manualTotal =
    manualProduct != null
      ? Math.round(discountedUnit(manualProduct.price, customer) * manualQtyNum)
      : 0;

  function closeManual() {
    setManualProduct(null);
    setManualQty("");
    focusScan();
  }

  function confirmManual() {
    if (!manualProduct) return;
    if (manualQtyNum <= 0) {
      toast.error("Ingresa la cantidad");
      return;
    }
    const qty =
      manualProduct.unit === "unit"
        ? Math.round(manualQtyNum)
        : Math.round(manualQtyNum * 1000) / 1000;
    pushItem(manualProduct, qty);
    closeManual();
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
    focusScan();
  }

  function reset() {
    setItems([]);
    setReceived("");
    setScanValue("");
    setMethod("cash");
    setCustomer(null);
    focusScan();
  }

  function charge() {
    if (items.length === 0) {
      toast.error("No hay productos en la venta");
      return;
    }
    if (method === "credit" && !customer) {
      toast.error("Una venta a crédito requiere un cliente");
      return;
    }
    if (method === "cash" && receivedNum < totals.total) {
      toast.error("El monto recibido es menor al total");
      return;
    }

    const isCash = method === "cash";
    const isCredit = method === "credit";

    startTransition(async () => {
      const r = await completeSale({
        payment_method: method,
        customer_id: customer?.id ?? null,
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        total: totals.total,
        amount_paid: isCash ? receivedNum : isCredit ? 0 : totals.total,
        change_given: isCash ? change : 0,
        items: items.map((it) => {
          const l = lineOf(it, customer);
          return {
            product_id: it.productId,
            quantity: it.quantity,
            unit_price: l.unit,
            total_price: l.total,
          };
        }),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }

      // Factura para impresión
      setInvoice({
        saleId: r.saleId,
        date: new Date(),
        customerName: customer?.name ?? null,
        method,
        lines: items.map((it) => {
          const l = lineOf(it, customer);
          return {
            name: it.name,
            qtyLabel: qtyLabel(it),
            unitPrice: l.unit,
            discount: l.discount,
            total: l.total,
          };
        }),
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        total: totals.total,
        received: isCash ? receivedNum : 0,
        change: isCash ? change : 0,
      });

      const changeNow = change;
      // Espera al render de la factura antes de abrir el diálogo de impresión.
      setTimeout(() => {
        window.print();
        if (isCash) {
          setChangeValue(changeNow);
          setChangeOpen(true);
        } else {
          toast.success(
            isCredit ? "Venta a crédito registrada" : "Venta cobrada",
          );
          reset();
        }
      }, 80);
    });
  }

  function finishCashSale() {
    setChangeOpen(false);
    reset();
  }

  if (!mounted) return null;

  if (!isDesktop) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-6 py-16 text-center">
        <div className="max-w-sm">
          <Monitor className="mx-auto mb-4 size-12 text-text-tertiary" />
          <h1 className="text-[19px] font-semibold text-foreground">
            POS solo en el computador
          </h1>
          <p className="mt-1 text-[15px] text-secondary-foreground">
            El POS solo está disponible desde el computador del negocio.
          </p>
        </div>
      </main>
    );
  }

  const hasDiscount = totals.discountTotal > 0;

  return (
    <>
      {/* Estilos de impresión: solo la factura sale por la impresora. */}
      <style>{`
        .pos-invoice { position: fixed; left: -10000px; top: 0; }
        @media print {
          body * { visibility: hidden !important; }
          .pos-invoice, .pos-invoice * { visibility: visible !important; }
          .pos-invoice {
            position: fixed; left: 0; top: 0;
            width: 72mm; padding: 4mm 2mm;
            font-family: ui-monospace, "SF Mono", Menlo, monospace;
            color: #000; background: #fff;
          }
        }
      `}</style>

      <main className="mx-auto max-w-6xl px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-red-soft)] text-primary">
              <ScanLine className="size-5" />
            </span>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">
              Punto de venta
            </h1>
          </div>
          <Button
            variant="secondary"
            className="h-9"
            onClick={() => toast.info("Devoluciones: disponible próximamente")}
          >
            <RotateCcw className="size-4" />
            Devoluciones
          </Button>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-4">
          {/* ZONA IZQUIERDA — productos */}
          <section className="flex flex-col">
            <div className="relative mb-3 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-red-soft)] text-primary">
                <ScanLine className="size-5" />
              </span>
              <div className="relative flex-1">
                <input
                  ref={scanRef}
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={onScanKey}
                  onFocus={() => setScanFocused(true)}
                  onBlur={() => setScanFocused(false)}
                  autoComplete="off"
                  aria-label="Entrada del lector de código de barras"
                  placeholder="Escanea el ticket o escribe un código…"
                  className={`h-14 w-full rounded-2xl bg-card px-4 pr-11 text-[15px] text-foreground shadow-sm outline-none transition-shadow placeholder:text-text-tertiary ${
                    scanFocused ? "ring-2 ring-danger" : "ring-1 ring-border"
                  }`}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 flex size-3 -translate-y-1/2">
                  {scanFocused && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
                  )}
                  <span
                    className={`relative inline-flex size-3 rounded-full ${
                      scanFocused ? "bg-success" : "bg-text-tertiary"
                    }`}
                  />
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-card shadow-sm">
              {items.length === 0 ? (
                <div className="grid h-full min-h-[50vh] place-items-center px-6 text-center">
                  <p className="text-[15px] text-secondary-foreground">
                    Escanea un producto para empezar la venta.
                  </p>
                </div>
              ) : (
                <ul className="max-h-[calc(100dvh-19rem)] divide-y divide-border overflow-y-auto">
                  {items.map((it) => {
                    const l = lineOf(it, customer);
                    return (
                      <li
                        key={it.key}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-foreground">
                            {it.name}
                          </p>
                          <p className="text-[13px] text-secondary-foreground tabular-nums">
                            {qtyLabel(it)} ·{" "}
                            {l.discount > 0 ? (
                              <>
                                <span className="line-through">
                                  {formatCOP(it.unitPrice)}
                                </span>{" "}
                                {formatCOP(l.unit)}
                              </>
                            ) : (
                              formatCOP(it.unitPrice)
                            )}
                            {it.unit === "kg" ? "/kg" : "/u"}
                            {l.discount > 0 && (
                              <span className="ml-1 text-success">
                                −{formatCOP(l.discount)}
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="shrink-0 text-[15px] font-semibold text-foreground tabular-nums">
                          {formatCOP(l.total)}
                        </p>
                        <button
                          onClick={() => removeItem(it.key)}
                          aria-label="Quitar"
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-destructive transition-colors hover:bg-[var(--brand-red-soft)]"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between px-1 text-[13px] text-secondary-foreground tabular-nums">
              <span>
                {items.length} {items.length === 1 ? "producto" : "productos"}
              </span>
              <span>{totalKg.toFixed(3)} kg total</span>
            </div>
          </section>

          {/* ZONA DERECHA — cobro */}
          <aside className="flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-sm">
            {/* Método de pago */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                Método de pago
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-[var(--radius-md)] bg-secondary px-4 py-3 text-[15px] font-medium text-foreground">
                  {PAY_LABELS[method]}
                  <ChevronDown className="size-4 text-text-tertiary" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-48">
                  {(["cash", "card", "transfer"] as PayMethod[]).map((m) => (
                    <DropdownMenuItem key={m} onClick={() => setMethod(m)}>
                      {PAY_LABELS[m]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem
                    disabled={!customer}
                    onClick={() => customer && setMethod("credit")}
                  >
                    {customer
                      ? "A crédito"
                      : "A crédito (elige un cliente)"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Cliente */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                Cliente
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] bg-secondary px-4 py-3 text-left text-[15px] font-medium text-foreground">
                  <span className="flex min-w-0 items-center gap-2">
                    <User className="size-4 shrink-0 text-text-tertiary" />
                    <span className="truncate">
                      {customer?.name ?? "Venta de contado"}
                    </span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-text-tertiary" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 min-w-56 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setCustomer(null)}>
                    Venta de contado
                  </DropdownMenuItem>
                  {customers.map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => setCustomer(c)}>
                      {c.name}
                      {c.discount_type && c.discount_value > 0 && (
                        <span className="ml-2 text-xs text-success">
                          {c.discount_type === "percentage"
                            ? `−${c.discount_value}%`
                            : `−${formatCOP(c.discount_value)}`}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Totales */}
            <div className="rounded-2xl bg-secondary px-5 py-4 text-center">
              {hasDiscount && (
                <div className="mb-2 space-y-0.5 text-left text-[13px] tabular-nums">
                  <div className="flex justify-between text-secondary-foreground">
                    <span>Subtotal</span>
                    <span>{formatCOP(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-success">
                    <span>Descuento</span>
                    <span>−{formatCOP(totals.discountTotal)}</span>
                  </div>
                </div>
              )}
              <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                Total a cobrar
              </p>
              <p className="mt-1 text-[40px] font-bold leading-none tracking-tight text-foreground tabular-nums">
                {formatCOP(totals.total)}
              </p>
            </div>

            {method === "cash" && (
              <div className="grid gap-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                  Recibido
                </label>
                <Input
                  inputMode="numeric"
                  placeholder="$"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  className="text-right text-[18px] font-semibold"
                />
                <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-2.5">
                  <span className="text-[13px] text-secondary-foreground">
                    Cambio
                  </span>
                  <span
                    className={`text-[17px] font-bold tabular-nums ${
                      change < 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    {formatCOP(Math.max(0, change))}
                  </span>
                </div>
              </div>
            )}

            {method === "credit" && customer && (
              <div className="rounded-xl bg-warning/10 px-4 py-2.5 text-[13px] text-foreground">
                Queda pendiente de pago a nombre de{" "}
                <span className="font-semibold">{customer.name}</span>.
              </div>
            )}

            <Button
              className="mt-1 h-14 w-full text-[17px] font-semibold"
              disabled={
                isPending ||
                items.length === 0 ||
                (method === "cash" && receivedNum < totals.total) ||
                (method === "credit" && !customer)
              }
              onClick={charge}
            >
              {isPending && <Loader2 className="size-5 animate-spin" />}
              {method === "credit"
                ? `Registrar ${formatCOP(totals.total)} a crédito`
                : `Cobrar ${formatCOP(totals.total)}`}
            </Button>

            <Button
              variant="ghost"
              className="h-9 text-secondary-foreground"
              disabled={isPending || items.length === 0}
              onClick={reset}
            >
              Cancelar venta
            </Button>
          </aside>
        </div>

        {/* Entrada manual */}
        <Dialog
          open={manualProduct !== null}
          onOpenChange={(o) => !o && closeManual()}
        >
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>{manualProduct?.name ?? "Producto"}</DialogTitle>
            </DialogHeader>
            {manualProduct && (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="manual-qty">
                    {manualProduct.unit === "unit"
                      ? "Cantidad (unidades)"
                      : "Peso (kg)"}
                  </Label>
                  <Input
                    id="manual-qty"
                    autoFocus
                    inputMode={
                      manualProduct.unit === "unit" ? "numeric" : "decimal"
                    }
                    placeholder={manualProduct.unit === "unit" ? "0" : "0,00"}
                    value={manualQty}
                    onChange={(e) => setManualQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmManual();
                      }
                    }}
                    className="text-right text-[18px] font-semibold"
                  />
                  <p className="text-[13px] text-secondary-foreground">
                    {formatCOP(discountedUnit(manualProduct.price, customer))}
                    {manualProduct.unit === "unit" ? "/u" : "/kg"}
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-2.5">
                  <span className="text-[13px] text-secondary-foreground">
                    Total
                  </span>
                  <span className="text-[17px] font-bold text-foreground tabular-nums">
                    {formatCOP(manualTotal)}
                  </span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="secondary" onClick={closeManual}>
                Cancelar
              </Button>
              <Button onClick={confirmManual}>Agregar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cambio a devolver (solo efectivo) */}
        <Dialog open={changeOpen} onOpenChange={(o) => !o && finishCashSale()}>
          <DialogContent showCloseButton={false} className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-center">
                Cambio a devolver
              </DialogTitle>
            </DialogHeader>
            <p className="text-center text-[44px] font-bold leading-none tracking-tight text-success tabular-nums">
              {formatCOP(Math.max(0, changeValue))}
            </p>
            <Button
              className="mt-2 h-12 w-full gap-2 text-[16px] font-semibold"
              onClick={finishCashSale}
            >
              <Check className="size-5" />
              OK · Nueva venta
            </Button>
          </DialogContent>
        </Dialog>
      </main>

      {/* Factura térmica (solo visible al imprimir) */}
      {invoice && <InvoiceReceipt invoice={invoice} />}
    </>
  );
}

function InvoiceReceipt({ invoice }: { invoice: Invoice }) {
  const isCredit = invoice.method === "credit";
  const d = invoice.date;
  const pad = (n: number) => String(n).padStart(2, "0");
  const fecha = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return (
    <div className="pos-invoice text-[11px] leading-tight">
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "1px" }}>
          CARNEGÜEY
        </div>
        <div>{fecha}</div>
        <div>Venta #{invoice.saleId.slice(0, 8).toUpperCase()}</div>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {invoice.lines.map((l, i) => (
        <div key={i} style={{ marginBottom: "3px" }}>
          <div style={{ fontWeight: 700 }}>{l.name}</div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              {l.qtyLabel} x {formatCOP(l.unitPrice)}
            </span>
            <span>{formatCOP(l.total)}</span>
          </div>
          {l.discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Descuento</span>
              <span>-{formatCOP(l.discount)}</span>
            </div>
          )}
        </div>
      ))}

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {invoice.discountTotal > 0 && (
        <>
          <Row label="Subtotal" value={formatCOP(invoice.subtotal)} />
          <Row
            label="Descuento"
            value={`-${formatCOP(invoice.discountTotal)}`}
          />
        </>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "14px",
          fontWeight: 700,
          margin: "3px 0",
        }}
      >
        <span>TOTAL</span>
        <span>{formatCOP(invoice.total)}</span>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      <Row
        label="Pago"
        value={
          isCredit
            ? "A crédito"
            : invoice.method === "cash"
              ? "Efectivo"
              : invoice.method === "card"
                ? "Tarjeta"
                : "Transferencia"
        }
      />
      {invoice.method === "cash" && (
        <>
          <Row label="Recibido" value={formatCOP(invoice.received)} />
          <Row label="Cambio" value={formatCOP(Math.max(0, invoice.change))} />
        </>
      )}
      {isCredit && (
        <div
          style={{
            textAlign: "center",
            fontWeight: 700,
            margin: "6px 0",
            border: "1px solid #000",
            padding: "3px",
          }}
        >
          PENDIENTE DE PAGO
          <br />
          Cliente: {invoice.customerName ?? "—"}
        </div>
      )}
      {!isCredit && invoice.customerName && (
        <Row label="Cliente" value={invoice.customerName} />
      )}

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
      <div style={{ textAlign: "center", marginTop: "4px" }}>
        ¡Gracias por su compra!
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
