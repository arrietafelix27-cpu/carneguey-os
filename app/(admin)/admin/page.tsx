import Link from "next/link";
import {
  Boxes,
  ClipboardCheck,
  Package,
  ShoppingCart,
  Truck,
  Users,
  ChevronRight,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

const SECTIONS = [
  {
    href: "/admin/productos",
    label: "Productos",
    desc: "Catálogo de cortes y productos",
    icon: Package,
    ready: true,
  },
  {
    href: "/admin/proveedores",
    label: "Proveedores",
    desc: "Lista de proveedores",
    icon: Truck,
    ready: true,
  },
  {
    href: "#",
    label: "Inventario",
    desc: "Próximamente",
    icon: Boxes,
    ready: false,
  },
  {
    href: "#",
    label: "Lotes",
    desc: "Próximamente",
    icon: ShoppingCart,
    ready: false,
  },
  {
    href: "#",
    label: "Conteos",
    desc: "Próximamente",
    icon: ClipboardCheck,
    ready: false,
  },
  {
    href: "#",
    label: "Usuarios",
    desc: "Próximamente",
    icon: Users,
    ready: false,
  },
];

export default async function AdminHome() {
  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Panel de administración
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Hola, {profile.full_name}
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(({ href, label, desc, icon: Icon, ready }) =>
          ready ? (
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
          ) : (
            <div
              key={label}
              className="flex items-center gap-4 rounded-xl border border-border bg-card/50 p-4 opacity-60"
            >
              <span className="grid size-11 place-items-center rounded-lg bg-muted text-muted-foreground">
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
            </div>
          ),
        )}
      </div>
    </main>
  );
}
