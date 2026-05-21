import Link from "next/link";
import {
  Boxes,
  ClipboardCheck,
  History,
  Package,
  ShoppingCart,
  Truck,
  ChevronRight,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

const SECTIONS = [
  {
    href: "/admin/entradas",
    label: "Últimas entradas",
    desc: "Todo lo que registran las cajeras",
    icon: History,
  },
  {
    href: "/admin/inventario",
    label: "Inventario",
    desc: "Cuánto hay y su valor",
    icon: Boxes,
  },
  {
    href: "/admin/conteo",
    label: "Conteo quincenal",
    desc: "Ingresar ventas y verificar",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/lotes/nuevo-en-pie",
    label: "Ganado en pie",
    desc: "Registrar res comprada viva",
    icon: ShoppingCart,
  },
  {
    href: "/admin/productos",
    label: "Productos",
    desc: "Catálogo de cortes y productos",
    icon: Package,
  },
  {
    href: "/admin/proveedores",
    label: "Proveedores",
    desc: "Lista de proveedores",
    icon: Truck,
  },
];

export default async function AdminHome() {
  const profile = await getCurrentProfile();
  const firstName = profile.full_name.split(" ")[0];

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Panel de administración</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Hola, {firstName}
        </h1>
      </header>

      <ul className="overflow-hidden rounded-3xl bg-card">
        {SECTIONS.map(({ href, label, desc, icon: Icon }, i) => (
          <li
            key={label}
            className={i > 0 ? "border-t border-border/60" : undefined}
          >
            <Link
              href={href}
              className="flex items-center gap-4 px-5 py-4 transition-colors active:bg-secondary"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <Icon className="size-5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-foreground">
                  {label}
                </span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {desc}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground/60" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
