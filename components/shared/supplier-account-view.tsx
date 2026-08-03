"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Lock,
  Unlock,
  FileText,
  HandCoins,
  Trash2,
} from "lucide-react";
import { formatCOP } from "@/lib/format";
import {
  createSupplierInvoice,
  registerSupplierPayment,
  setSupplierInvoicePrivate,
  setProviderPrivate,
} from "@/lib/actions/suppliers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export type InvoiceRow = {
  id: string;
  createdAt: string;
  amount: number;
  paid: number;
  remaining: number;
  dueDate: string | null;
  description: string;
  status: "pending" | "partial" | "paid";
  isPrivate: boolean;
};

export type PaymentRow = {
  id: string;
  createdAt: string;
  invoiceDescription: string;
  amount: number;
  source: "cash" | "owner_contribution";
  notes: string | null;
};

type PayLine = { amount: string; source: "cash" | "owner_contribution" };

const SOURCE_LABEL: Record<string, string> = {
  cash: "De caja",
  owner_contribution: "Aporte del dueño",
};

export function SupplierAccountView({
  providerId,
  providerIsPrivate,
  invoices,
  payments,
  pendingTotal,
  isAdmin,
}: {
  providerId: string;
  providerIsPrivate: boolean;
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  pendingTotal: number;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ---- Proveedor privado/abierto (solo admin) ----
  function toggleProviderPrivate() {
    startTransition(async () => {
      const r = await setProviderPrivate(providerId, !providerIsPrivate);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        providerIsPrivate ? "Proveedor ahora es abierto" : "Proveedor marcado como privado",
      );
      router.refresh();
    });
  }

  // ---- Nueva factura (solo admin) ----
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invAmount, setInvAmount] = useState("");
  const [invDescription, setInvDescription] = useState("");
  const [invDueDate, setInvDueDate] = useState("");
  const [invPrivate, setInvPrivate] = useState(false);

  function openInvoice() {
    setInvAmount("");
    setInvDescription("");
    setInvDueDate("");
    setInvPrivate(false);
    setInvoiceOpen(true);
  }

  function submitInvoice() {
    startTransition(async () => {
      const r = await createSupplierInvoice({
        provider_id: providerId,
        amount: invAmount,
        description: invDescription,
        due_date: invDueDate,
        is_private: invPrivate,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Factura registrada");
      setInvoiceOpen(false);
      router.refresh();
    });
  }

  // ---- Marcar factura privada/pública (solo admin) ----
  function toggleInvoicePrivate(inv: InvoiceRow) {
    startTransition(async () => {
      const r = await setSupplierInvoicePrivate(inv.id, !inv.isPrivate);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        inv.isPrivate ? "Factura ahora es pública" : "Factura marcada como privada",
      );
      router.refresh();
    });
  }

  // ---- Registrar pago (con posible división en dos líneas) ----
  const [payTarget, setPayTarget] = useState<InvoiceRow | null>(null);
  const [payLines, setPayLines] = useState<PayLine[]>([
    { amount: "", source: "cash" },
  ]);
  const [payNotes, setPayNotes] = useState("");

  function openPay(inv: InvoiceRow) {
    setPayTarget(inv);
    setPayLines([{ amount: "", source: "cash" }]);
    setPayNotes("");
  }

  function updateLine(index: number, patch: Partial<PayLine>) {
    setPayLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    );
  }

  function addLine() {
    setPayLines((prev) => [...prev, { amount: "", source: "owner_contribution" }]);
  }

  function removeLine(index: number) {
    setPayLines((prev) => prev.filter((_, i) => i !== index));
  }

  function submitPayment() {
    if (!payTarget) return;
    const lines = payLines.filter((l) => l.amount.trim() !== "");
    if (lines.length === 0) {
      toast.error("Ingresa al menos un monto");
      return;
    }
    startTransition(async () => {
      for (const line of lines) {
        const r = await registerSupplierPayment(providerId, {
          invoice_id: payTarget.id,
          amount: line.amount,
          source: line.source,
          notes: payNotes,
        });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
      }
      toast.success(lines.length > 1 ? "Pagos registrados" : "Pago registrado");
      setPayTarget(null);
      router.refresh();
    });
  }

  const pending = invoices.filter((i) => i.status !== "paid");

  return (
    <div>
      {isAdmin && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-2">
            {providerIsPrivate ? (
              <Lock className="size-4 shrink-0 text-secondary-foreground" />
            ) : (
              <Unlock className="size-4 shrink-0 text-secondary-foreground" />
            )}
            <span className="truncate text-[14px] text-foreground">
              {providerIsPrivate
                ? "Proveedor privado — la cajera no lo ve"
                : "Proveedor abierto — la cajera lo ve"}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={isPending}
            onClick={toggleProviderPrivate}
          >
            {providerIsPrivate ? "Hacer abierto" : "Hacer privado"}
          </Button>
        </div>
      )}

      <div className="mb-5 rounded-3xl bg-primary px-6 py-6 text-center shadow-[var(--shadow-brand)]">
        <p className="text-[13px] font-medium uppercase tracking-wide text-primary-foreground/80">
          Saldo pendiente
        </p>
        <p className="mt-1 text-[32px] font-bold leading-tight tracking-tight text-primary-foreground tabular-nums">
          {formatCOP(pendingTotal)}
        </p>
      </div>

      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Facturas pendientes
        </h2>
        {isAdmin && (
          <Button size="sm" className="h-8 gap-1.5" onClick={openInvoice}>
            <Plus className="size-4" />
            Agregar factura
          </Button>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="mb-6 rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
          No hay facturas pendientes.
        </div>
      ) : (
        <ul className="mb-6 overflow-hidden rounded-3xl bg-card shadow-sm">
          {pending.map((inv, i) => (
            <li
              key={inv.id}
              className={`px-4 py-3.5 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--brand-red-soft)] text-primary">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[15px] font-medium text-foreground">
                    {inv.description}
                  </p>
                  <p className="text-[13px] text-secondary-foreground">
                    {format(new Date(inv.createdAt), "dd/MM/yyyy")}
                    {inv.dueDate
                      ? ` · vence ${format(new Date(inv.dueDate), "dd/MM/yyyy")}`
                      : ""}
                    {inv.status === "partial" ? " · Pago parcial" : ""}
                  </p>
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => toggleInvoicePrivate(inv)}
                    disabled={isPending}
                    aria-label={
                      inv.isPrivate ? "Marcar como pública" : "Marcar como privada"
                    }
                    className="shrink-0 rounded-full p-1.5 text-secondary-foreground transition-colors hover:bg-secondary"
                  >
                    {inv.isPrivate ? (
                      <Lock className="size-4" />
                    ) : (
                      <Unlock className="size-4" />
                    )}
                  </button>
                ) : (
                  inv.isPrivate && (
                    <Lock className="size-3.5 shrink-0 text-secondary-foreground" />
                  )
                )}
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-danger tabular-nums">
                    {formatCOP(inv.remaining)}
                  </p>
                  {inv.paid > 0 && (
                    <p className="text-xs text-muted-foreground">
                      de {formatCOP(inv.amount)}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="secondary"
                className="mt-3 h-9 w-full gap-1.5"
                onClick={() => openPay(inv)}
              >
                <HandCoins className="size-4" />
                Registrar pago
              </Button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Historial de pagos
      </h2>
      {payments.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
          Todavía no hay pagos registrados.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {payments.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center justify-between gap-3 px-4 py-3.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-foreground">
                  {p.invoiceDescription}
                </p>
                <p className="text-[13px] text-secondary-foreground">
                  {format(new Date(p.createdAt), "dd/MM/yyyy HH:mm")} ·{" "}
                  {SOURCE_LABEL[p.source] ?? p.source}
                </p>
              </div>
              <p className="shrink-0 font-semibold text-success tabular-nums">
                {formatCOP(p.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Nueva factura */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva factura</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="inv-amount">Monto</Label>
              <Input
                id="inv-amount"
                autoFocus
                inputMode="numeric"
                placeholder="$"
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
                className="text-right text-[18px] font-semibold"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-desc">Descripción</Label>
              <Textarea
                id="inv-desc"
                rows={2}
                placeholder="Ej: Res del 12/07"
                value={invDescription}
                onChange={(e) => setInvDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-due">Fecha límite (opcional)</Label>
              <Input
                id="inv-due"
                type="date"
                value={invDueDate}
                onChange={(e) => setInvDueDate(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2.5 rounded-xl bg-secondary px-3 py-2.5">
              <input
                type="checkbox"
                checked={invPrivate}
                onChange={(e) => setInvPrivate(e.target.checked)}
                className="size-5 accent-[var(--brand-red)]"
              />
              <span className="text-[14px] text-foreground">
                Privada — la cajera nunca la ve ni la puede pagar
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setInvoiceOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={submitInvoice}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar pago */}
      <Dialog open={payTarget !== null} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{payTarget?.description ?? "Pago"}</DialogTitle>
          </DialogHeader>

          {payTarget && (
            <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-2.5">
              <span className="text-[13px] text-secondary-foreground">
                Saldo pendiente
              </span>
              <span className="text-[17px] font-bold text-danger tabular-nums">
                {formatCOP(payTarget.remaining)}
              </span>
            </div>
          )}

          <div className="grid gap-4">
            {payLines.map((line, i) => (
              <div key={i} className="grid gap-3 rounded-2xl bg-secondary/60 p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`pay-amount-${i}`}>
                    {payLines.length > 1 ? `Monto (línea ${i + 1})` : "Monto"}
                  </Label>
                  {payLines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-danger"
                      onClick={() => removeLine(i)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
                <Input
                  id={`pay-amount-${i}`}
                  autoFocus={i === 0}
                  inputMode="numeric"
                  placeholder="$"
                  value={line.amount}
                  onChange={(e) => updateLine(i, { amount: e.target.value })}
                  className="text-right text-[18px] font-semibold"
                />
                <div className="grid gap-2">
                  <Label>Fuente del dinero</Label>
                  <Select
                    value={line.source}
                    onValueChange={(v) =>
                      updateLine(i, {
                        source: (v as PayLine["source"]) ?? "cash",
                      })
                    }
                  >
                    <SelectTrigger>
                      <span>{SOURCE_LABEL[line.source]}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">De caja</SelectItem>
                      <SelectItem value="owner_contribution">
                        Aporte del dueño
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}

            {payLines.length < 2 && (
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={addLine}
              >
                <Plus className="size-4" />
                Pago mixto — agregar otra línea
              </Button>
            )}

            <div className="grid gap-2">
              <Label htmlFor="pay-notes">Notas (opcional)</Label>
              <Textarea
                id="pay-notes"
                rows={2}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPayTarget(null)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={submitPayment}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
