"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Camera, CheckCircle2, CalendarDays } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { registerPayrollPayment } from "@/lib/actions/payroll";
import { compressImage } from "@/lib/compress-image";
import {
  uploadReceiptPhoto,
  PHASE_LABEL,
  type UploadPhase,
} from "@/lib/upload-receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type LoanRow = {
  id: string;
  amount: number;
  remaining: number;
  createdAt: string; // dd/MM/yyyy
};

export type PayEmployee = {
  id: string;
  name: string;
  role: string | null;
  salary: number;
  loans: LoanRow[];
};

type Period = "first" | "second";

const PERIOD_LABEL: Record<Period, string> = {
  first: "Primera quincena (día 15)",
  second: "Segunda quincena (día 30)",
};

function money(s: string): number {
  const d = s.replace(/[^\d]/g, "");
  return d === "" ? 0 : Number(d);
}

export function PayrollPayment({
  employees,
  today,
}: {
  employees: PayEmployee[];
  today: string;
}) {
  const [period, setPeriod] = useState<Period | null>(null);
  const [date, setDate] = useState(today);

  return (
    <div className="grid gap-6">
      {/* PASO 1 — período + fecha */}
      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Paso 1 · Período
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["first", "second"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-2xl px-4 py-4 text-left text-[15px] font-semibold transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-brand)]"
                  : "bg-secondary text-foreground"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          <Label htmlFor="pdate">Fecha del pago</Label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-text-tertiary" />
            <Input
              id="pdate"
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="pl-11"
            />
          </div>
        </div>
      </section>

      {/* PASO 2 — empleados */}
      {period && (
        <section>
          <p className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Paso 2 · Pagar empleado por empleado
          </p>
          {employees.length === 0 ? (
            <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
              No hay empleados activos.
            </div>
          ) : (
            <div className="grid gap-4">
              {employees.map((e) => (
                <EmployeePayCard
                  key={e.id}
                  employee={e}
                  period={period}
                  date={date}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EmployeePayCard({
  employee,
  period,
  date,
}: {
  employee: PayEmployee;
  period: Period;
  date: string;
}) {
  const router = useRouter();
  const [paid, setPaid] = useState(false);

  const quincenal = Math.round(employee.salary / 2);

  const [sel, setSel] = useState<Record<string, { on: boolean; amount: string }>>(
    () =>
      Object.fromEntries(
        employee.loans.map((l) => [
          l.id,
          { on: false, amount: String(Math.round(l.remaining)) },
        ]),
      ),
  );

  const totalDed = employee.loans.reduce(
    (s, l) => (sel[l.id]?.on ? s + money(sel[l.id].amount) : s),
    0,
  );
  const computedNet = Math.max(0, quincenal - totalDed);

  const [paidTouched, setPaidTouched] = useState(false);
  const [montoPagado, setMontoPagado] = useState(String(computedNet));
  useEffect(() => {
    if (!paidTouched) setMontoPagado(String(computedNet));
  }, [computedNet, paidTouched]);

  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const busy = phase !== "idle";

  function toggle(id: string) {
    setSel((p) => ({ ...p, [id]: { ...p[id], on: !p[id].on } }));
  }
  function setAmt(id: string, v: string) {
    setSel((p) => ({ ...p, [id]: { ...p[id], amount: v } }));
  }

  function register() {
    if (busy) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("La foto de la hoja firmada es obligatoria");
      return;
    }
    const deductions = employee.loans
      .filter((l) => sel[l.id]?.on && money(sel[l.id].amount) > 0)
      .map((l) => ({
        employee_loan_id: l.id,
        description: `Préstamo del ${l.createdAt}`,
        amount: money(sel[l.id].amount),
      }));

    (async () => {
      try {
        setPhase("compressing");
        const compressed = await compressImage(file);
        setPhase("uploading");
        const path = await uploadReceiptPhoto(compressed, "payroll_payment");
        setPhase("saving");
        const r = await registerPayrollPayment({
          payment_date: date,
          period,
          employee_id: employee.id,
          gross: quincenal,
          net: money(montoPagado),
          notes: notes || null,
          receipt_url: path,
          deductions,
        });
        if ("error" in r) {
          toast.error(r.error);
          setPhase("idle");
          return;
        }
        setPhase("done");
        toast.success(`Pago de ${employee.name} registrado`);
        setTimeout(() => {
          setPaid(true);
          setPhase("idle");
          router.refresh();
        }, 700);
      } catch {
        toast.error("No se pudo subir la foto. Intenta de nuevo.");
        setPhase("idle");
      }
    })();
  }

  if (paid) {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-success/10 px-5 py-4">
        <CheckCircle2 className="size-6 shrink-0 text-success" />
        <div>
          <p className="text-[15px] font-semibold text-foreground">
            {employee.name}
          </p>
          <p className="text-[13px] text-success">Pago registrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold text-foreground">
            {employee.name}
          </p>
          <p className="text-[13px] text-secondary-foreground">
            {employee.role ?? "Sin cargo"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-secondary-foreground tabular-nums">
            Mensual {formatCOP(employee.salary)}
          </p>
          <p className="text-[15px] font-semibold text-foreground tabular-nums">
            Quincenal {formatCOP(quincenal)}
          </p>
        </div>
      </div>

      {/* Préstamos a descontar */}
      {employee.loans.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Préstamos por descontar
          </p>
          <ul className="overflow-hidden rounded-2xl bg-secondary">
            {employee.loans.map((l, i) => {
              const s = sel[l.id];
              return (
                <li
                  key={l.id}
                  className={`grid grid-cols-[auto_1fr_8rem] items-center gap-3 px-4 py-3 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={s?.on ?? false}
                    onChange={() => toggle(l.id)}
                    className="size-5 accent-[var(--brand-red)]"
                    aria-label={`Descontar préstamo del ${l.createdAt}`}
                  />
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-foreground">
                      Préstamo del {l.createdAt}
                    </p>
                    <p className="text-[12px] text-secondary-foreground tabular-nums">
                      Saldo {formatCOP(l.remaining)}
                    </p>
                  </div>
                  <Input
                    inputMode="numeric"
                    value={s?.amount ?? ""}
                    onChange={(e) => setAmt(l.id, e.target.value)}
                    disabled={!s?.on}
                    className="h-9 text-right text-[14px] font-semibold disabled:opacity-50"
                  />
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between px-1 text-[14px]">
            <span className="text-secondary-foreground">
              Total deducciones
            </span>
            <span className="font-semibold text-danger tabular-nums">
              −{formatCOP(totalDed)}
            </span>
          </div>
        </div>
      )}

      {/* Neto */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary px-4 py-3">
        <span className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Neto a pagar
        </span>
        <span className="text-[20px] font-bold text-foreground tabular-nums">
          {formatCOP(computedNet)}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        <Label htmlFor={`paid-${employee.id}`}>Monto pagado</Label>
        <Input
          id={`paid-${employee.id}`}
          inputMode="numeric"
          value={montoPagado}
          onChange={(e) => {
            setPaidTouched(true);
            setMontoPagado(e.target.value);
          }}
          className="text-right text-[16px] font-semibold"
        />
      </div>

      <div className="mt-3 grid gap-2">
        <Label htmlFor={`notes-${employee.id}`}>Notas (opcional)</Label>
        <Textarea
          id={`notes-${employee.id}`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Foto obligatoria */}
      <div className="mt-3 grid gap-2">
        <Label htmlFor={`photo-${employee.id}`}>
          Foto de la hoja firmada (obligatoria)
        </Label>
        <label
          htmlFor={`photo-${employee.id}`}
          className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] bg-secondary px-4 py-3.5 text-[15px] text-foreground"
        >
          <Camera className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">
            {fileName || "Tomar o elegir foto"}
          </span>
        </label>
        <input
          id={`photo-${employee.id}`}
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
      </div>

      <Button
        className="mt-4 h-12 w-full gap-2 text-base font-semibold"
        disabled={busy}
        onClick={register}
      >
        {phase === "done" ? (
          <CheckCircle2 className="size-5" />
        ) : busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : null}
        {busy ? PHASE_LABEL[phase] : `Registrar pago · ${formatCOP(money(montoPagado))}`}
      </Button>
    </div>
  );
}
