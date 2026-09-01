"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Receipt,
  Undo2,
  Ban,
  PackageCheck,
  ShoppingCart,
  Scissors,
  ArrowLeftRight,
  Split,
  Banknote,
  HandCoins,
  Truck,
  CalendarCheck,
  ClipboardCheck,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { formatCOP } from "@/lib/format";
import type { ActivityEvent, ActivityKind } from "@/lib/activity";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ActivityPerson = {
  id: string;
  name: string;
  role: "admin" | "employee";
};

const ICONS: Record<ActivityKind, LucideIcon> = {
  sale: Receipt,
  sale_void: Ban,
  sale_return: Undo2,
  purchase_lot: PackageCheck,
  direct_purchase: ShoppingCart,
  desposte: Scissors,
  cut_transfer: ArrowLeftRight,
  sub_desposte: Split,
  cash_outflow: Banknote,
  credit_payment: HandCoins,
  supplier_payment: Truck,
  day_closing: CalendarCheck,
  count: ClipboardCheck,
};

/** Agrupa por día en hora de Colombia. */
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityFeed({
  events,
  people,
  from,
  to,
  userId,
  onlyUnsupervised,
  todayLabel,
}: {
  events: ActivityEvent[];
  people: ActivityPerson[];
  from: string;
  to: string;
  userId: string;
  onlyUnsupervised: boolean;
  todayLabel: string;
}) {
  const router = useRouter();

  const apply = useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams({ from, to });
      if (userId) params.set("user", userId);
      if (onlyUnsupervised) params.set("solo", "1");
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      router.push(`/admin/actividad?${params.toString()}`);
    },
    [from, to, userId, onlyUnsupervised, router],
  );

  const byDay = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const k = dayKey(e.at);
    const arr = byDay.get(k) ?? [];
    arr.push(e);
    byDay.set(k, arr);
  }

  return (
    <>
      {/* Filtros */}
      <div className="mb-6 grid gap-3 rounded-3xl bg-card p-4 shadow-sm sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="from" className="text-[13px]">
            Desde
          </Label>
          <Input
            id="from"
            type="date"
            value={from}
            max={to}
            onChange={(e) => apply({ from: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="to" className="text-[13px]">
            Hasta
          </Label>
          <Input
            id="to"
            type="date"
            value={to}
            min={from}
            onChange={(e) => apply({ to: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="person" className="text-[13px]">
            Persona
          </Label>
          <select
            id="person"
            value={userId}
            onChange={(e) => apply({ user: e.target.value })}
            className="h-10 rounded-md border border-input bg-background px-3 text-[15px] text-foreground"
          >
            <option value="">Todo el equipo</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.role === "admin" ? " (dueño)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {onlyUnsupervised && (
        <Link
          href={`/admin/actividad?from=${from}&to=${to}${
            userId ? `&user=${userId}` : ""
          }`}
          className="mb-5 inline-block text-[15px] font-medium text-primary transition-opacity active:opacity-60"
        >
          ← Ver toda la actividad
        </Link>
      )}

      {events.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-14 text-center text-[15px] text-secondary-foreground shadow-sm">
          {onlyUnsupervised
            ? "No hay acciones delicadas sin tu aprobación en estas fechas."
            : "No hay movimientos en estas fechas."}
        </div>
      ) : (
        <div className="grid gap-6">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                {format(new Date(`${day}T12:00:00`), "dd/MM/yyyy") ===
                todayLabel
                  ? "Hoy"
                  : format(new Date(`${day}T12:00:00`), "dd/MM/yyyy")}
              </h2>
              <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
                {list.map((e, i) => {
                  const Icon = ICONS[e.kind];
                  const row = (
                    <div className="flex items-start gap-3.5 px-4 py-3.5">
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-2xl ${
                          e.unsupervised
                            ? "bg-[var(--brand-red-soft)] text-primary"
                            : "bg-accent text-accent-foreground"
                        }`}
                      >
                        <Icon className="size-5" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-snug text-foreground">
                          {e.title}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                          {e.who} · {timeLabel(e.at)} · {e.detail}
                        </p>
                        {e.unsupervised && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-[var(--brand-red-soft)] px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <ShieldAlert className="size-3" />
                            Sin tu aprobación
                          </p>
                        )}
                      </div>
                      {e.amount != null && (
                        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-foreground">
                          {formatCOP(e.amount)}
                        </span>
                      )}
                    </div>
                  );
                  return (
                    <li
                      key={e.id}
                      className={i > 0 ? "border-t border-border/60" : undefined}
                    >
                      {e.href ? (
                        <Link
                          href={e.href}
                          className="block transition-colors active:bg-secondary"
                        >
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
