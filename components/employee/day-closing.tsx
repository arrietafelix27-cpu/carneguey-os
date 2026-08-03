"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, TriangleAlert, Clock } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { OWNER_NAME } from "@/lib/config";
import { closeDay } from "@/lib/actions/closing";
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

export type DaySummary = {
  salesCash: number;
  salesCard: number;
  salesTransfer: number;
  creditSales: number;
  cpCash: number;
  cpCard: number;
  cpTransfer: number;
  outflowsApproved: number;
  outflowsPending: number;
  outflowsPendingCount: number;
  supplierPaymentsCash: number;
  expectedCash: number;
};

/** Tolerancia del cuadre: ±$2.000 se considera cuadrado. */
const TOLERANCE = 2000;

export function DayClosing({
  summary,
  alreadyClosed,
}: {
  summary: DaySummary;
  alreadyClosed: boolean;
}) {
  const router = useRouter();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const countedNum = Number(counted.replace(/[^\d]/g, "") || "0");
  const hasCount = counted.trim() !== "";
  const diff = countedNum - summary.expectedCash;
  const ok = Math.abs(diff) <= TOLERANCE;

  const blocked = summary.outflowsPendingCount > 0;

  // Mientras haya egresos pendientes, refresca solo para detectar cuando
  // el admin aprueba o rechaza el último y habilitar el botón.
  useEffect(() => {
    if (alreadyClosed || !blocked) return;
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [alreadyClosed, blocked, router]);

  function submit() {
    startTransition(async () => {
      const r = await closeDay(counted, notes);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Día cerrado");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  if (alreadyClosed) {
    return (
      <div className="rounded-3xl bg-card px-6 py-12 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-3 size-12 text-success" />
        <p className="text-[17px] font-semibold text-foreground">
          El día ya está cerrado
        </p>
        <p className="mt-1 text-[15px] text-secondary-foreground">
          No se puede modificar. {OWNER_NAME} ya puede ver el cuadre.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {/* Bloqueo por egresos pendientes */}
      {blocked && (
        <div className="flex gap-3 rounded-3xl bg-danger/10 px-5 py-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p className="text-[15px] font-semibold text-danger">
              No puedes cerrar el día todavía
            </p>
            <p className="mt-0.5 text-[14px] text-foreground">
              Hay{" "}
              <span className="font-semibold">
                {summary.outflowsPendingCount}{" "}
                {summary.outflowsPendingCount === 1
                  ? "egreso pendiente"
                  : "egresos pendientes"}
              </span>{" "}
              de aprobación por {formatCOP(summary.outflowsPending)}.{" "}
              {OWNER_NAME} debe aprobarlos o rechazarlos antes de cerrar la
              caja.
            </p>
            <p className="mt-1 text-[12px] text-secondary-foreground">
              Esta pantalla se actualiza sola cuando él los revise.
            </p>
          </div>
        </div>
      )}

      {/* Ingresos */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Ventas del día
        </h2>
        <Row label="Efectivo" value={summary.salesCash} strong />
        <Row label="Tarjeta" value={summary.salesCard} />
        <Row label="Transferencia" value={summary.salesTransfer} />
        <Row label="A crédito" value={summary.creditSales} muted />

        <h2 className="mb-3 mt-5 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Abonos de clientes
        </h2>
        <Row label="Efectivo" value={summary.cpCash} strong />
        <Row label="Tarjeta" value={summary.cpCard} />
        <Row label="Transferencia" value={summary.cpTransfer} />

        <h2 className="mb-3 mt-5 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Egresos de efectivo
        </h2>
        <Row
          label="Egresos aprobados"
          value={summary.outflowsApproved}
          negative
          strong
        />
        <Row
          label="Egresos pendientes (no restan)"
          value={summary.outflowsPending}
          warn={summary.outflowsPendingCount > 0}
        />

        <h2 className="mb-3 mt-5 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Pagos a proveedores
        </h2>
        <Row
          label="Pagado de caja"
          value={summary.supplierPaymentsCash}
          negative
          strong
        />
      </section>

      {/* Efectivo esperado */}
      <section className="rounded-3xl bg-primary px-6 py-5 text-center text-primary-foreground shadow-[var(--shadow-brand)]">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          Efectivo esperado en caja
        </p>
        <p className="mt-1.5 text-[34px] font-bold leading-none tracking-tight tabular-nums">
          {formatCOP(summary.expectedCash)}
        </p>
        <p className="mt-2 text-[12px] opacity-80">
          ventas en efectivo + abonos en efectivo − egresos aprobados − pagos
          a proveedores
        </p>
      </section>

      {/* Conteo físico */}
      <section className="grid gap-3 rounded-3xl bg-card p-5 shadow-sm">
        <div className="grid gap-2">
          <Label htmlFor="counted">¿Cuánto hay en caja ahora?</Label>
          <Input
            id="counted"
            inputMode="numeric"
            placeholder="$"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="h-14 text-right text-[22px] font-bold"
          />
        </div>

        {hasCount && (
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
              ok ? "bg-success/10" : "bg-danger/10"
            }`}
          >
            {ok ? (
              <CheckCircle2 className="size-5 shrink-0 text-success" />
            ) : (
              <TriangleAlert className="size-5 shrink-0 text-danger" />
            )}
            <div className="flex-1">
              <p
                className={`text-[15px] font-semibold ${
                  ok ? "text-success" : "text-danger"
                }`}
              >
                {ok
                  ? "La caja cuadra"
                  : diff > 0
                    ? `Sobran ${formatCOP(diff)}`
                    : `Faltan ${formatCOP(Math.abs(diff))}`}
              </p>
              <p className="text-[12px] text-secondary-foreground">
                {ok
                  ? `Diferencia dentro de la tolerancia (±${formatCOP(TOLERANCE)})`
                  : `Diferencia exacta: ${formatCOP(diff)}`}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <Button
          className="h-12 w-full text-base font-semibold"
          disabled={isPending || !hasCount || blocked}
          onClick={() => setConfirmOpen(true)}
        >
          Cerrar día
        </Button>
        {blocked && (
          <p className="text-center text-[13px] text-danger">
            Bloqueado: hay {summary.outflowsPendingCount}{" "}
            {summary.outflowsPendingCount === 1
              ? "egreso pendiente"
              : "egresos pendientes"}{" "}
            de aprobación.
          </p>
        )}
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Cerrar el día</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-secondary-foreground">
            Contaste{" "}
            <span className="font-semibold text-foreground">
              {formatCOP(countedNum)}
            </span>{" "}
            y se esperaban{" "}
            <span className="font-semibold text-foreground">
              {formatCOP(summary.expectedCash)}
            </span>
            . Una vez cerrado, el día no se puede modificar.
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Volver
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={submit}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  negative,
  warn,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  /** Muestra el monto como salida: -$X.XXX */
  negative?: boolean;
  /** Resalta en naranja (pendiente de aprobación). */
  warn?: boolean;
}) {
  const amountCls = warn
    ? "text-[14px] font-semibold text-warning"
    : strong
      ? "text-[16px] font-semibold text-foreground"
      : muted
        ? "text-[14px] text-text-tertiary"
        : "text-[14px] text-foreground";

  return (
    <div className="flex items-center justify-between py-1">
      <span
        className={`text-[14px] ${
          muted ? "text-text-tertiary" : "text-secondary-foreground"
        }`}
      >
        {label}
      </span>
      <span className={`tabular-nums ${amountCls}`}>
        {negative && value > 0 ? "−" : ""}
        {formatCOP(Math.abs(value))}
        {warn ? " ⚠️" : ""}
      </span>
    </div>
  );
}
