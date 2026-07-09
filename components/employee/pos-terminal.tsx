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
} from "lucide-react";
import { formatCOP } from "@/lib/format";
import { completeSale } from "@/lib/actions/sales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";

export type PosProduct = {
  id: string;
  pos_code: string;
  name: string;
  unit: "kg" | "unit";
  price: number;
};

type CartItem = {
  key: string;
  productId: string;
  name: string;
  unit: "kg" | "unit";
  quantity: number; // kg o unidades
  unitPrice: number;
  totalPrice: number;
};

type PayMethod = "cash" | "card" | "transfer" | "credit";

const PAY_LABELS: Record<PayMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  credit: "A crédito",
};

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

export function PosTerminal({ products }: { products: PosProduct[] }) {
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
  const [received, setReceived] = useState("");
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeValue, setChangeValue] = useState(0);
  const [isPending, startTransition] = useTransition();

  const scanRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");

  const total = useMemo(
    () => items.reduce((s, it) => s + it.totalPrice, 0),
    [items],
  );
  const totalKg = useMemo(
    () => items.reduce((s, it) => s + (it.unit === "kg" ? it.quantity : 0), 0),
    [items],
  );
  const receivedNum = Number(digitsOnly(received) || "0");
  const change = receivedNum - total;

  const focusScan = useCallback(() => {
    if (changeOpen) return;
    scanRef.current?.focus();
  }, [changeOpen]);

  useEffect(() => {
    if (!mounted || !isDesktop) return;
    focusScan();
    // Devuelve el foco al escáner al hacer clic fuera de un campo interactivo.
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

  const addScan = useCallback(
    (raw: string) => {
      const code = digitsOnly(raw);
      if (code.length < 6) return;
      // EAN-13 de la báscula: char1='2', 2-6 = pos_code, 7-11 = peso (gramos).
      const posCode = String(parseInt(code.slice(1, 6) || "0", 10));
      const grams = parseInt(code.slice(6, 11) || "0", 10);
      const kg = Math.round((grams / 1000) * 1000) / 1000;

      const product = cache.get(posCode);
      if (!product) {
        toast.error(`Producto no encontrado (código ${posCode})`);
        return;
      }

      const isUnit = product.unit === "unit";
      const quantity = isUnit ? 1 : kg;
      const totalPrice = isUnit
        ? Math.round(product.price)
        : Math.round(product.price * kg);

      setItems((prev) => [
        ...prev,
        {
          key: crypto.randomUUID(),
          productId: product.id,
          name: product.name,
          unit: product.unit,
          quantity,
          unitPrice: product.price,
          totalPrice,
        },
      ]);
    },
    [cache],
  );

  function onScanKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = scanValue;
      setScanValue("");
      if (v.trim()) addScan(v);
    }
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
    focusScan();
  }

  function charge() {
    if (items.length === 0) {
      toast.error("No hay productos en la venta");
      return;
    }
    if (method === "credit") return;
    if (method === "cash" && receivedNum < total) {
      toast.error("El monto recibido es menor al total");
      return;
    }

    startTransition(async () => {
      const r = await completeSale({
        payment_method: method,
        subtotal: total,
        total,
        amount_paid: method === "cash" ? receivedNum : null,
        change_given: method === "cash" ? change : null,
        items: items.map((it) => ({
          product_id: it.productId,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          total_price: it.totalPrice,
        })),
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (method === "cash") {
        setChangeValue(change);
        setChangeOpen(true);
      } else {
        toast.success("Venta cobrada");
        reset();
      }
    });
  }

  function finishCashSale() {
    setChangeOpen(false);
    reset();
  }

  // --- Estados de render (desktop only) ---
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

  return (
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
          {/* Barra de escaneo */}
          <div
            className="relative mb-3 flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm ring-1 ring-border"
            onClick={focusScan}
          >
            <ScanLine className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground">
                Listo para escanear
              </p>
              <p className="text-[13px] text-secondary-foreground">
                Escanea el ticket de la báscula
              </p>
            </div>
            <span className="relative flex size-3 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex size-3 rounded-full bg-success" />
            </span>
            {/* input invisible, siempre enfocado */}
            <input
              ref={scanRef}
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={onScanKey}
              onBlur={() => setTimeout(focusScan, 0)}
              inputMode="none"
              autoComplete="off"
              aria-label="Entrada del lector de código de barras"
              className="absolute inset-0 size-full cursor-default rounded-2xl bg-transparent text-transparent caret-transparent outline-none"
            />
          </div>

          {/* Lista de items */}
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-card shadow-sm">
            {items.length === 0 ? (
              <div className="grid h-full min-h-[50vh] place-items-center px-6 text-center">
                <p className="text-[15px] text-secondary-foreground">
                  Escanea un producto para empezar la venta.
                </p>
              </div>
            ) : (
              <ul className="max-h-[calc(100dvh-19rem)] divide-y divide-border overflow-y-auto">
                {items.map((it) => (
                  <li
                    key={it.key}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-foreground">
                        {it.name}
                      </p>
                      <p className="text-[13px] text-secondary-foreground tabular-nums">
                        {it.unit === "kg"
                          ? `${it.quantity.toFixed(3)} kg · ${formatCOP(it.unitPrice)}/kg`
                          : `1 u · ${formatCOP(it.unitPrice)}/u`}
                      </p>
                    </div>
                    <p className="shrink-0 text-[15px] font-semibold text-foreground tabular-nums">
                      {formatCOP(it.totalPrice)}
                    </p>
                    <button
                      onClick={() => removeItem(it.key)}
                      aria-label="Quitar"
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-destructive transition-colors hover:bg-[var(--brand-red-soft)]"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contador */}
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
              <DropdownMenuContent align="start" className="w-[var(--anchor-width)] min-w-40">
                {(["cash", "card", "transfer"] as PayMethod[]).map((m) => (
                  <DropdownMenuItem key={m} onClick={() => setMethod(m)}>
                    {PAY_LABELS[m]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem disabled>
                  A crédito (próximamente)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Total */}
          <div className="rounded-2xl bg-secondary px-5 py-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
              Total a cobrar
            </p>
            <p className="mt-1 text-[40px] font-bold leading-none tracking-tight text-foreground tabular-nums">
              {formatCOP(total)}
            </p>
          </div>

          {/* Efectivo: recibido + cambio */}
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

          <Button
            className="mt-1 h-14 w-full text-[17px] font-semibold"
            disabled={
              isPending ||
              items.length === 0 ||
              (method === "cash" && receivedNum < total)
            }
            onClick={charge}
          >
            {isPending && <Loader2 className="size-5 animate-spin" />}
            Cobrar {formatCOP(total)}
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

      {/* Cambio a devolver (solo efectivo) */}
      <Dialog open={changeOpen} onOpenChange={(o) => !o && finishCashSale()}>
        <DialogContent showCloseButton={false} className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Cambio a devolver</DialogTitle>
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
  );
}
