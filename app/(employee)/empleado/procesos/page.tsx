import Link from "next/link";
import { Scissors, ArrowLeftRight, Split, ChevronRight } from "lucide-react";

export const metadata = { title: "Procesos · Carnegüey" };

const OPTIONS = [
  {
    href: "/empleado/desposte",
    label: "Desposte",
    desc: "Despostar un lote en cortes",
    icon: Scissors,
  },
  {
    href: "/empleado/transferencias",
    label: "Transferencia de cortes",
    desc: "Mover kg de un corte a otro",
    icon: ArrowLeftRight,
  },
  {
    href: "/empleado/sub-desposte",
    label: "Sub-desposte",
    desc: "Transformar un corte en otros",
    icon: Split,
  },
];

export default function ProcesosMenu() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Procesos
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Procesos de inventario
      </h1>
      <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {OPTIONS.map(({ href, label, desc, icon: Icon }, i) => (
          <li
            key={label}
            className={i > 0 ? "border-t border-border" : undefined}
          >
            <Link
              href={href}
              className="flex items-center gap-4 px-4 py-4 transition-colors active:bg-secondary"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-red-soft)] text-primary">
                <Icon className="size-[22px]" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-foreground">
                  {label}
                </span>
                <span className="block text-[13px] text-secondary-foreground">
                  {desc}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-text-tertiary" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
