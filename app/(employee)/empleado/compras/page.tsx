import Link from "next/link";
import {
  Beef,
  PiggyBank,
  Truck,
  Bird,
  Package,
  Scissors,
  ChevronRight,
} from "lucide-react";

export const metadata = { title: "Compras" };

const OPTIONS = [
  {
    href: "/empleado/compras/canal-directo",
    label: "Canal directo (res)",
    desc: "Canales de res compradas directamente",
    icon: Beef,
  },
  {
    href: "/empleado/compras/cerdo",
    label: "Cerdo en canal",
    desc: "Cerdos o medias canales",
    icon: PiggyBank,
  },
  {
    href: "/empleado/compras/llegada-canales",
    label: "Llegada de canales",
    desc: "Recibir canales de un lote de ganado en pie",
    icon: Truck,
  },
  {
    href: "/empleado/compras/pollo",
    label: "Pollo",
    desc: "Productos directos o pollo entero para desposte",
    icon: Bird,
  },
  {
    href: "/empleado/compras/otros",
    label: "Otros productos",
    desc: "Arepas, chorizos, queso, suero, etc.",
    icon: Package,
  },
  {
    href: "/empleado/compras/corte-directo",
    label: "Compra directa de corte",
    desc: "Cortes que se agotaron y se compran sueltos",
    icon: Scissors,
  },
];

export default function ComprasMenu() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Compras
      </p>
      <h1 className="mb-6 mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Registrar compra
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
