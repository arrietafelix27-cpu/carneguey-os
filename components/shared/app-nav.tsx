"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Boxes,
  BarChart3,
  ScanLine,
  Users,
  Truck,
  CalendarCheck,
  IdCard,
  Package,
  Settings,
  Banknote,
  ArrowLeftRight,
  Split,
  ClipboardCheck,
  PackageCheck,
  History,
  ShoppingCart,
  Wallet,
  Scissors,
  ArrowLeft,
  Menu,
  LogOut,
  Loader2,
  Receipt,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";

type Item = { href: string; label: string; icon: LucideIcon };
type Section = { title?: string; items: Item[] };

type Role = "admin" | "employee";

// ── Configuración de módulos por rol ───────────────────────────────────────
const ADMIN_HOME = "/admin";
const EMPLOYEE_HOME = "/empleado";

const ADMIN_DESKTOP: Item[] = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/inventario", label: "Inventario", icon: Boxes },
  { href: "/admin/analitica", label: "Analítica", icon: BarChart3 },
  { href: "/empleado/pos", label: "POS", icon: ScanLine },
  { href: "/admin/ventas", label: "Historial de ventas", icon: Receipt },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/proveedores", label: "Proveedores", icon: Truck },
  { href: "/admin/cuadre", label: "Cuadre de caja", icon: CalendarCheck },
  { href: "/admin/empleados", label: "Nómina", icon: IdCard },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

const ADMIN_MOBILE: Section[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: Home },
      { href: "/admin/inventario", label: "Inventario", icon: Boxes },
      { href: "/admin/analitica", label: "Analítica", icon: BarChart3 },
      { href: "/admin/clientes", label: "Clientes", icon: Users },
      { href: "/admin/empleados", label: "Nómina", icon: IdCard },
      { href: "/empleado/pos", label: "POS", icon: ScanLine },
      { href: "/admin/ventas", label: "Historial de ventas", icon: Receipt },
    ],
  },
  {
    title: "Más módulos",
    items: [
      { href: "/admin/cuadre", label: "Cuadre de caja", icon: CalendarCheck },
      { href: "/admin/egresos", label: "Egresos de efectivo", icon: Banknote },
      { href: "/admin/productos", label: "Productos", icon: Package },
      { href: "/admin/proveedores", label: "Proveedores", icon: Truck },
      {
        href: "/admin/transferencias",
        label: "Transferencias",
        icon: ArrowLeftRight,
      },
      { href: "/admin/sub-despostes", label: "Sub-despostes", icon: Split },
      { href: "/admin/conteos", label: "Conteo quincenal", icon: ClipboardCheck },
      { href: "/admin/lotes/activos", label: "Lotes activos", icon: PackageCheck },
      { href: "/admin/entradas", label: "Últimas entradas", icon: History },
      { href: "/admin/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

const CASHIER_DESKTOP: Item[] = [
  { href: "/empleado/pos", label: "POS", icon: ScanLine },
  { href: "/empleado/ventas-dia", label: "Ventas del día", icon: Receipt },
  { href: "/empleado/clientes", label: "Clientes", icon: Users },
  { href: "/empleado/cierre", label: "Cerrar día", icon: CalendarCheck },
];

const CASHIER_MOBILE: Section[] = [
  {
    items: [
      { href: "/empleado", label: "Inicio", icon: Home },
      { href: "/empleado/compras", label: "Compras", icon: ShoppingCart },
      { href: "/empleado/ventas-dia", label: "Ventas del día", icon: Receipt },
    ],
  },
  {
    title: "Procesos",
    items: [
      { href: "/empleado/desposte", label: "Desposte", icon: Scissors },
      {
        href: "/empleado/transferencias",
        label: "Transferencias",
        icon: ArrowLeftRight,
      },
      { href: "/empleado/sub-desposte", label: "Sub-desposte", icon: Split },
    ],
  },
  {
    items: [
      { href: "/empleado/gastos", label: "Gastos y salidas", icon: Wallet },
      { href: "/empleado/clientes", label: "Clientes", icon: Users },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === ADMIN_HOME || href === EMPLOYEE_HOME) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppNav({
  role,
  fullName,
}: {
  role: Role;
  fullName: string;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const home = role === "admin" ? ADMIN_HOME : EMPLOYEE_HOME;
  const desktop = role === "admin" ? ADMIN_DESKTOP : CASHIER_DESKTOP;
  const mobile = role === "admin" ? ADMIN_MOBILE : CASHIER_MOBILE;

  return (
    <>
      {/* ── Barra lateral (PC) ────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15%] flex-col border-r border-border bg-card lg:flex">
        <Link
          href={home}
          className="flex items-center gap-2.5 px-4 py-5"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-[var(--shadow-brand)]">
            CG
          </span>
          <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
            Carnegüey OS
          </span>
        </Link>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <ul className="grid gap-1">
            {desktop.map((it) => {
              const active = isActive(pathname, it.href);
              const Icon = it.icon;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-secondary-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon className="size-[18px] shrink-0" strokeWidth={2} />
                    <span className="truncate">{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <SidebarFooter fullName={fullName} />
      </aside>

      {/* ── Barra inferior (móvil) ────────────────────────────────────── */}
      <MobileBar home={home} onMenu={() => setDrawerOpen(true)} />

      {/* ── Drawer de módulos (móvil) ─────────────────────────────────── */}
      {drawerOpen && (
        <MobileDrawer
          sections={mobile}
          pathname={pathname}
          fullName={fullName}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}

function SidebarFooter({ fullName }: { fullName: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="border-t border-border p-3">
      <p className="truncate px-2 pb-2 text-[13px] font-medium text-foreground">
        {fullName}
      </p>
      <button
        onClick={() => startTransition(() => logout())}
        disabled={isPending}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-destructive transition-colors hover:bg-[var(--brand-red-soft)] disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="size-[18px] animate-spin" />
        ) : (
          <LogOut className="size-[18px]" />
        )}
        Cerrar sesión
      </button>
    </div>
  );
}

function MobileBar({
  home,
  onMenu,
}: {
  home: string;
  onMenu: () => void;
}) {
  const router = useRouter();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-2xl">
        <button
          onClick={() => router.back()}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-text-tertiary transition-transform active:scale-90"
          aria-label="Volver atrás"
        >
          <ArrowLeft className="size-6" />
          <span className="text-[10px] font-medium tracking-wide">Atrás</span>
        </button>
        <Link
          href={home}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-text-tertiary transition-transform active:scale-90"
          aria-label="Inicio"
        >
          <Home className="size-6" />
          <span className="text-[10px] font-medium tracking-wide">Inicio</span>
        </Link>
        <button
          onClick={onMenu}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-text-tertiary transition-transform active:scale-90"
          aria-label="Menú"
        >
          <Menu className="size-6" />
          <span className="text-[10px] font-medium tracking-wide">Menú</span>
        </button>
      </div>
    </nav>
  );
}

function MobileDrawer({
  sections,
  pathname,
  fullName,
  onClose,
}: {
  sections: Section[];
  pathname: string;
  fullName: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Cerrar menú"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in-0"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-md animate-in slide-in-from-bottom-4 duration-200">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <span className="text-[17px] font-bold tracking-tight text-foreground">
            Menú
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-9 place-items-center rounded-full bg-secondary text-secondary-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="px-3 py-3">
          {sections.map((section, si) => (
            <div key={si} className={si > 0 ? "mt-4" : undefined}>
              {section.title && (
                <p className="px-3 pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                  {section.title}
                </p>
              )}
              <ul className="grid gap-1">
                {section.items.map((it) => {
                  const active = isActive(pathname, it.href);
                  const Icon = it.icon;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground active:bg-secondary"
                        }`}
                      >
                        <Icon className="size-5 shrink-0" strokeWidth={2} />
                        <span className="truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="mt-4 border-t border-border pt-3">
            <p className="truncate px-3 pb-2 text-[13px] font-medium text-foreground">
              {fullName}
            </p>
            <button
              onClick={() => startTransition(() => logout())}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium text-destructive active:bg-[var(--brand-red-soft)] disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <LogOut className="size-5" />
              )}
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
