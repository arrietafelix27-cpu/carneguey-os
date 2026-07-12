import Link from "next/link";
import {
  ShoppingCart,
  ArrowLeftRight,
  Split,
  Users,
  Wallet,
  CalendarCheck,
  ChevronRight,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

const ACTIONS = [
  {
    href: "/empleado/compras",
    label: "Compras",
    desc: "Registrar mercancía que llega",
    icon: ShoppingCart,
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
  {
    href: "/empleado/clientes",
    label: "Clientes",
    desc: "Ver saldos y registrar abonos",
    icon: Users,
  },
  {
    href: "/empleado/gastos",
    label: "Gastos y salidas",
    desc: "Entregas SF, préstamos y gastos",
    icon: Wallet,
  },
  {
    href: "/empleado/cierre",
    label: "Cerrar día",
    desc: "Cuadre de caja del día",
    icon: CalendarCheck,
  },
];

export default async function EmployeeHome() {
  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Punto de operación
      </p>
      <h1 className="mb-7 mt-1 text-[34px] font-bold leading-tight tracking-tight text-foreground">
        Hola, {profile.full_name}
      </h1>

      <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {ACTIONS.map(({ href, label, desc, icon: Icon }, i) => (
          <li
            key={label}
            className={i > 0 ? "border-t border-border" : undefined}
          >
            <Link
              href={href}
              className="flex items-center gap-4 px-4 py-4 transition-colors active:bg-secondary"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-red-soft)] text-primary">
                <Icon className="size-6" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold text-foreground">
                  {label}
                </span>
                <span className="block text-[14px] text-secondary-foreground">
                  {desc}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-text-tertiary" />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 px-1 text-[14px] text-secondary-foreground">
        El desposte está en la barra de abajo. El inventario se habilitará en
        los próximos pasos.
      </p>
    </main>
  );
}
