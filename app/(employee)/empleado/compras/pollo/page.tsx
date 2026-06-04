import Link from "next/link";
import { ChevronLeft, ChevronRight, Bird, Scissors } from "lucide-react";

export const metadata = { title: "Pollo · Carnegüey" };

const OPTIONS = [
  {
    href: "/empleado/compras/pollo/directos",
    label: "Productos directos",
    desc: "Pechuga, muslos, alas, etc. que entran al inventario",
    icon: Bird,
  },
  {
    href: "/empleado/compras/pollo/desposte",
    label: "Pollo para desposte",
    desc: "Pollos enteros que se despostan después",
    icon: Scissors,
  },
];

export default function PolloMenu() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/empleado/compras"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Compras
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">
        ¿Cómo llega el pollo?
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Elige cómo viene la mercancía para registrarla correctamente.
      </p>
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
