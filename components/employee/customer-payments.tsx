"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, User } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { registerCreditPayment } from "@/lib/actions/customers";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export type PosCustomerBalance = {
  id: string;
  name: string;
  phone: string | null;
  balance: number;
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
};

export function CustomerPayments({
  customers,
}: {
  customers: PosCustomerBalance[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PosCustomerBalance | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [isPending, startTransition] = useTransition();

  // Con saldo pendiente primero (alfabético), luego el resto (alfabético).
  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = customers.filter(
      (c) => q === "" || c.name.toLowerCase().includes(q),
    );
    const byName = (a: PosCustomerBalance, b: PosCustomerBalance) =>
      a.name.localeCompare(b.name, "es");
    return [
      ...visible.filter((c) => c.balance > 0).sort(byName),
      ...visible.filter((c) => c.balance <= 0).sort(byName),
    ];
  }, [customers, query]);

  function open(c: PosCustomerBalance) {
    setPicked(c);
    setAmount("");
    setMethod("cash");
  }

  function close() {
    setPicked(null);
    setAmount("");
  }

  function submit() {
    if (!picked) return;
    startTransition(async () => {
      const r = await registerCreditPayment({
        customer_id: picked.id,
        sale_id: null,
        amount,
        payment_method: method,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Abono registrado");
      close();
      router.refresh();
    });
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-text-tertiary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente"
          className="pl-11"
          inputMode="search"
        />
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
          No hay clientes activos.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {ordered.map((c, i) => (
            <li
              key={c.id}
              className={i > 0 ? "border-t border-border" : undefined}
            >
              <button
                onClick={() => open(c)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-secondary"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-red-soft)] text-primary">
                  <User className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-foreground">
                    {c.name}
                  </span>
                  <span className="block text-[13px] text-secondary-foreground">
                    {c.phone ?? "Sin teléfono"}
                  </span>
                </span>
                {c.balance > 0 ? (
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold text-danger tabular-nums">
                      {formatCOP(c.balance)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      pendiente
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 text-[13px] text-success">
                    Al día
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={picked !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{picked?.name ?? "Cliente"}</DialogTitle>
          </DialogHeader>

          {picked && picked.balance > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-2.5">
              <span className="text-[13px] text-secondary-foreground">
                Saldo pendiente
              </span>
              <span className="text-[17px] font-bold text-danger tabular-nums">
                {formatCOP(picked.balance)}
              </span>
            </div>
          )}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="abono">Monto</Label>
              <Input
                id="abono"
                autoFocus
                inputMode="numeric"
                placeholder="$"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-right text-[18px] font-semibold"
              />
            </div>
            <div className="grid gap-2">
              <Label>Método de pago</Label>
              <Select value={method} onValueChange={(v) => setMethod(v ?? "cash")}>
                <SelectTrigger>
                  <span>{METHOD_LABEL[method]}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={close} disabled={isPending}>
              Cancelar
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={submit}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Registrar abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
