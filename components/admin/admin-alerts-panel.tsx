import Link from "next/link";
import {
  Clock,
  TrendingDown,
  Calendar,
  Package,
  Bird,
  ArrowLeftRight,
  Split,
  Banknote,
  TriangleAlert,
  ChevronRight,
} from "lucide-react";
import type { Alert, AlertIcon } from "@/lib/admin-alerts";

const ICONS: Record<AlertIcon, typeof Clock> = {
  clock: Clock,
  "trending-down": TrendingDown,
  calendar: Calendar,
  package: Package,
  bird: Bird,
  transfer: ArrowLeftRight,
  split: Split,
  banknote: Banknote,
};

export function AdminAlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <TriangleAlert className="size-3.5 text-primary" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Alertas activas
        </h2>
      </div>
      <ul className="overflow-hidden rounded-3xl bg-[var(--brand-red-soft)] shadow-sm">
        {alerts.map((a, i) => {
          const Icon = ICONS[a.icon] ?? TriangleAlert;
          const tint =
            a.severity === "danger"
              ? "bg-danger/12 text-danger"
              : "bg-warning/15 text-warning";
          return (
            <li
              key={a.id}
              className={
                i > 0 ? "border-t border-[var(--brand-red)]/10" : undefined
              }
            >
              <Link
                href={a.href}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-[var(--brand-red)]/8"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] ${tint}`}
                >
                  <Icon className="size-[18px]" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-foreground">
                    {a.title}
                  </span>
                  {a.description && (
                    <span className="block truncate text-[13px] text-secondary-foreground">
                      {a.description}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0 text-[var(--brand-red)]/40" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
