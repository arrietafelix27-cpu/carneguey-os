"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { createCashOutflow } from "@/lib/actions/cash-outflows";
import {
  OUTFLOW_CATEGORIES,
  OUTFLOW_LABELS,
  NEEDS_APPROVAL,
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

export type TodayOutflow = {
  id: string;
  amount: number;
  category: OutflowCategory;
  recipient: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

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

export function CashOutflowForm({ today }: { today: TodayOutflow[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<OutflowCategory>("sf");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const needsApproval = NEEDS_APPROVAL.includes(category);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await createCashOutflow({ category, amount, recipient, notes });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        needsApproval
          ? "Egreso registrado. Queda pendiente de aprobación."
          : "Egreso registrado",
      );
      setAmount("");
      setRecipient("");
      setNotes("");
      router.refresh();
    });
  }

  const totalToday = today
    .filter((o) => o.status !== "rejected")
    .reduce((s, o) => s + o.amount, 0);

  return (
    <div className="grid gap-6">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        <div className="grid gap-2">
          <Label>Categoría</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory((v ?? "sf") as OutflowCategory)}
          >
            <SelectTrigger>
              <span>{OUTFLOW_LABELS[category]}</span>
            </SelectTrigger>
            <SelectContent>
              {OUTFLOW_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {OUTFLOW_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

        <div className="grid gap-2">
          <Label htmlFor="recipient">A quién (opcional)</Label>
          <Input
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">Notas (opcional)</Label>
          <Textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {needsApproval && (
          <p className="rounded-xl bg-warning/10 px-4 py-2.5 text-[13px] text-foreground">
            Este egreso queda <span className="font-semibold">pendiente</span>{" "}
            hasta que Félix lo apruebe.
          </p>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="h-12 w-full gap-2 text-base font-semibold"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Registrar egreso
        </Button>
      </form>

      <div>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Egresos de hoy
          </h2>
          <span className="text-[13px] font-semibold text-foreground tabular-nums">
            {formatCOP(totalToday)}
          </span>
        </div>
        {today.length === 0 ? (
          <div className="rounded-3xl bg-card px-6 py-10 text-center text-[15px] text-secondary-foreground shadow-sm">
            No has registrado egresos hoy.
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
            {today.map((o, i) => {
              const meta = STATUS_META[o.status] ?? STATUS_META.rejected;
              return (
                <li
                  key={o.id}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-foreground">
                      {OUTFLOW_LABELS[o.category]}
                    </p>
                    <p className="truncate text-[13px] text-secondary-foreground">
                      {o.recipient ? `${o.recipient} · ` : ""}
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
