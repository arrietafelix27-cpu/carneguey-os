import Link from "next/link";
import {
  Clock,
  TrendingDown,
  Calendar,
  Package,
  Bird,
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
};

export function AdminAlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2 px-1">
        <TriangleAlert className="size-4 text-warning" />
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Alertas activas
        </h2>
      </div>
      <ul className="overflow-hidden rounded-3xl bg-card">
        {alerts.map((a, i) => {
          const Icon = ICONS[a.icon] ?? TriangleAlert;
          const tint =
            a.severity === "danger"
              ? "bg-danger/10 text-danger"
              : "bg-warning/10 text-warning";
          return (
            <li
              key={a.id}
              className={i > 0 ? "border-t border-border/60" : undefined}
            >
              <Link
                href={a.href}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-secondary"
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${tint}`}
                >
                  <Icon className="size-4" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-foreground">
                    {a.title}
                  </span>
                  {a.description && (
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {a.description}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
