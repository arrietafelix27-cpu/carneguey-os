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

export const metadata = { title: "Compras · Carnegüey" };

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
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-foreground">
        Registrar compra
      </h1>
      <div className="grid gap-3">
        {OPTIONS.map(({ href, label, desc, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-transform active:scale-[0.98]"
          >
            <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-foreground">
                {label}
              </span>
              <span className="block text-sm text-muted-foreground">
                {desc}
              </span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </main>
  );
}
