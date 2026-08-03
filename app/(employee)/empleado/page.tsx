import Link from "next/link";
import {
  ScanLine,
  ChevronRight,
  ShoppingCart,
  Split,
  Wallet,
  Users,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Inicio" };

type Shortcut = {
  href: string;
  label: string;
  icon: LucideIcon;
  wide?: boolean;
};

const MOBILE_SHORTCUTS: Shortcut[] = [
  { href: "/empleado/compras", label: "Compras", icon: ShoppingCart },
  { href: "/empleado/procesos", label: "Procesos", icon: Split },
  { href: "/empleado/gastos", label: "Gastos y salidas", icon: Wallet },
  { href: "/empleado/clientes", label: "Clientes", icon: Users },
  { href: "/empleado/proveedores", label: "Proveedores", icon: Truck, wide: true },
];

export default async function EmployeeHome() {
  const profile = await getCurrentProfile();
  const firstName = profile.full_name.split(" ")[0];

  return (
    <main className="mx-auto max-w-2xl px-4 py-9">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Punto de operación
      </p>
      <h1 className="mb-8 mt-1 text-[34px] font-bold leading-tight tracking-tight text-foreground">
        Hola, {firstName}
      </h1>

      {/* PC: acceso directo al POS (solo funciona en computador) */}
      <Link
        href="/empleado/pos"
        className="hidden items-center gap-4 rounded-3xl bg-primary px-6 py-6 text-primary-foreground shadow-[var(--shadow-brand)] transition-transform active:scale-[0.98] lg:flex"
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15">
          <ScanLine className="size-7" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[20px] font-bold tracking-tight">
            Abrir POS
          </span>
          <span className="block text-[14px] text-primary-foreground/80">
            Escanear y cobrar
          </span>
        </span>
        <ChevronRight className="size-6 shrink-0 text-primary-foreground/70" />
      </Link>

      {/* Móvil: accesos directos a los módulos principales */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        {MOBILE_SHORTCUTS.map(({ href, label, icon: Icon, wide }) =>
          wide ? (
            <Link
              key={href}
              href={href}
              className="col-span-2 flex items-center gap-4 rounded-3xl bg-card px-5 py-4 shadow-sm transition-transform active:scale-[0.98]"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-red-soft)] text-primary">
                <Icon className="size-6" strokeWidth={2} />
              </span>
              <span className="flex-1 text-[16px] font-semibold text-foreground">
                {label}
              </span>
              <ChevronRight className="size-5 shrink-0 text-text-tertiary" />
            </Link>
          ) : (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-card px-4 py-8 text-center shadow-sm transition-transform active:scale-[0.97]"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-[var(--brand-red-soft)] text-primary">
                <Icon className="size-7" strokeWidth={2} />
              </span>
              <span className="text-[15px] font-semibold text-foreground">
                {label}
              </span>
            </Link>
          ),
        )}
      </div>
    </main>
  );
}
