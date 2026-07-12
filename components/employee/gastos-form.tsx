"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Camera, HandCoins, UserPlus, Receipt } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { createGasto } from "@/lib/actions/gastos";
import {
  EXPENSE_SUBCATEGORIES,
  SUBCATEGORY_LABELS,
  OUTFLOW_LABELS,
  type OutflowCategory,
} from "@/lib/validations/cash-outflow";
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

export type Employee = { id: string; name: string };

export type TodayGasto = {
  id: string;
  amount: number;
  category: OutflowCategory;
  subcategory: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

type Tab = "sf" | "employee_advance" | "expense";

const TABS: { key: Tab; label: string; icon: typeof HandCoins }[] = [
  { key: "sf", label: "Entrega a Félix", icon: HandCoins },
  { key: "employee_advance", label: "Préstamo", icon: UserPlus },
  { key: "expense", label: "Gasto operativo", icon: Receipt },
];

const STATUS_META: Record<string, { label: string; bg: string; text: string }> =
  {
    pending: { label: "Pendiente", bg: "bg-warning/15", text: "text-warning" },
    approved: { label: "Aprobado", bg: "bg-success/15", text: "text-success" },
    rejected: {
      label: "Rechazado",
      bg: "bg-[var(--bg-muted)]",
      text: "text-secondary-foreground",
    },
  };

export function GastosForm({
  employees,
  today,
}: {
  employees: Employee[];
  today: TodayGasto[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("sf");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function resetFields() {
    setAmount("");
    setNotes("");
    setDescription("");
    setSubcategory("");
    setEmployeeId("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("La foto del soporte es obligatoria");
      return;
    }

    const fd = new FormData();
    fd.set("category", tab);
    fd.set("amount", amount);
    fd.set("photo", file);
    if (tab === "sf") fd.set("notes", notes);
    if (tab === "employee_advance") {
      fd.set("employee_id", employeeId);
      fd.set("notes", notes);
    }
    if (tab === "expense") {
      fd.set("subcategory", subcategory);
      fd.set("description", description);
    }

    startTransition(async () => {
      const r = await createGasto(fd);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        tab === "expense"
          ? "Gasto registrado"
          : "Registrado. Queda pendiente de aprobación.",
      );
      resetFields();
      router.refresh();
    });
  }

  const photoLabel: Record<Tab, string> = {
    sf: "Foto del soporte (obligatoria)",
    employee_advance: "Foto del recibo firmado (obligatoria)",
    expense: "Foto de la factura (obligatoria)",
  };

  return (
    <div className="grid gap-6">
      {/* Selector de categoría */}
      <div className="grid grid-cols-3 gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center transition-colors ${
              tab === key
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-brand)]"
                : "bg-card text-secondary-foreground shadow-sm"
            }`}
          >
            <Icon className="size-5" strokeWidth={2} />
            <span className="text-[12px] font-semibold leading-tight">
              {label}
            </span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-4" noValidate>
        {tab === "employee_advance" && (
          <div className="grid gap-2">
            <Label>Empleado</Label>
            <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")}>
              <SelectTrigger>
                <span className={employeeId ? "" : "text-text-tertiary"}>
                  {employees.find((e) => e.id === employeeId)?.name ??
                    "Elige el empleado"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {employees.length === 0 && (
              <p className="text-[13px] text-secondary-foreground">
                No hay empleados registrados. Félix debe crearlos en Nómina.
              </p>
            )}
          </div>
        )}

        {tab === "expense" && (
          <>
            <div className="grid gap-2">
              <Label>Subcategoría</Label>
              <Select
                value={subcategory}
                onValueChange={(v) => setSubcategory(v ?? "")}
              >
                <SelectTrigger>
                  <span className={subcategory ? "" : "text-text-tertiary"}>
                    {subcategory
                      ? SUBCATEGORY_LABELS[
                          subcategory as keyof typeof SUBCATEGORY_LABELS
                        ]
                      : "Elige la subcategoría"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_SUBCATEGORIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SUBCATEGORY_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desc">Descripción corta</Label>
              <Input
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="grid gap-2">
          <Label htmlFor="amount">Monto</Label>
          <Input
            id="amount"
            inputMode="numeric"
            placeholder="$"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-right text-[18px] font-semibold"
          />
        </div>

        {(tab === "sf" || tab === "employee_advance") && (
          <div className="grid gap-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        {/* Foto obligatoria */}
        <div className="grid gap-2">
          <Label htmlFor="photo">{photoLabel[tab]}</Label>
          <label
            htmlFor="photo"
            className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] bg-secondary px-4 py-3.5 text-[15px] text-foreground"
          >
            <Camera className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              {fileName || "Tomar o elegir foto"}
            </span>
          </label>
          <input
            id="photo"
            name="photo"
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          />
        </div>

        {tab !== "expense" && (
          <p className="rounded-xl bg-warning/10 px-4 py-2.5 text-[13px] text-foreground">
            Queda <span className="font-semibold">pendiente</span> hasta que
            Félix lo apruebe.
          </p>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="h-12 w-full gap-2 text-base font-semibold"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Registrar
        </Button>
      </form>

      {/* Registros de hoy */}
      <div>
        <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Registrados hoy
        </h2>
        {today.length === 0 ? (
          <div className="rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
            No has registrado nada hoy.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {today.map((o, i) => {
              const meta = STATUS_META[o.status] ?? STATUS_META.rejected;
              const label =
                o.category === "expense" && o.subcategory
                  ? SUBCATEGORY_LABELS[
                      o.subcategory as keyof typeof SUBCATEGORY_LABELS
                    ]
                  : OUTFLOW_LABELS[o.category];
              return (
                <li
                  key={o.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {label}
                    </p>
                    <p className="text-[13px] text-secondary-foreground">
                      {o.createdAt}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                  <p className="shrink-0 font-semibold text-foreground tabular-nums">
                    {formatCOP(o.amount)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
