"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Receipt,
  Boxes,
  History,
  Warehouse,
  PackageCheck,
  ShoppingCart,
  BarChart3,
  ArrowLeftRight,
  Split,
  Wallet,
  CalendarCheck,
  Banknote,
  Users,
  Truck,
  IdCard,
  HandCoins,
  Settings,
  Package,
  UsersRound,
  ScanLine,
  Beef,
  PiggyBank,
  Bird,
  Scissors,
  ArrowLeft,
  Menu,
  LogOut,
  Loader2,
  ChevronDown,
  KeyRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/lib/actions/auth";
import { PRODUCT_NAME } from "@/lib/config";

type Leaf = { href: string; label: string; icon: LucideIcon };
type Group = { label: string; icon: LucideIcon; children: Leaf[] };
type Entry = Leaf | Group;
type Role = "admin" | "employee";

const isGroup = (e: Entry): e is Group => "children" in e;

// ── Configuración de módulos por rol ───────────────────────────────────────
const ADMIN_HOME = "/admin";
const EMPLOYEE_HOME = "/empleado";

// Admin: misma estructura en PC y móvil.
const ADMIN_NAV: Entry[] = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/ventas", label: "Ventas", icon: Receipt },
  {
    label: "Inventario",
    icon: Boxes,
    children: [
      { href: "/admin/entradas", label: "Últimas entradas", icon: History },
      { href: "/admin/inventario", label: "Inventario actual", icon: Warehouse },
      { href: "/admin/lotes/activos", label: "Lotes activos", icon: PackageCheck },
      { href: "/admin/lotes/nuevo-en-pie", label: "Ganado en pie", icon: ShoppingCart },
    ],
  },
  {
    label: "Procesos",
    icon: Scissors,
    children: [
      { href: "/admin/transferencias", label: "Transferencias", icon: ArrowLeftRight },
      { href: "/admin/sub-despostes", label: "Sub-despostes", icon: Split },
      { href: "/admin/analitica", label: "Analítica", icon: BarChart3 },
    ],
  },
  {
    label: "Finanzas",
    icon: Wallet,
    children: [
      { href: "/admin/cuadre", label: "Cuadre de caja", icon: CalendarCheck },
      { href: "/admin/egresos", label: "Egresos", icon: Banknote },
    ],
  },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/proveedores", label: "Proveedores", icon: Truck },
  {
    label: "Nómina",
    icon: IdCard,
    children: [
      { href: "/admin/empleados", label: "Empleados", icon: Users },
      { href: "/admin/nomina/pago", label: "Realizar pago", icon: HandCoins },
    ],
  },
  {
    label: "Configuración",
    icon: Settings,
    children: [
      { href: "/admin/productos", label: "Productos", icon: Package },
      { href: "/admin/equipo", label: "Equipo", icon: UsersRound },
    ],
  },
];

// Cajera PC: todo directo, sin submenús.
const CASHIER_DESKTOP: Entry[] = [
  { href: "/empleado/pos", label: "POS", icon: ScanLine },
  { href: "/empleado/ventas-dia", label: "Ventas del día", icon: Receipt },
  { href: "/empleado/clientes", label: "Clientes", icon: Users },
  { href: "/empleado/proveedores", label: "Proveedores", icon: Truck },
  { href: "/empleado/cierre", label: "Cerrar día", icon: CalendarCheck },
];

// Cajera móvil: submenús de Compras y Procesos. Sin Proveedores (solo PC).
const CASHIER_MOBILE: Entry[] = [
  {
    label: "Compras",
    icon: ShoppingCart,
    children: [
      { href: "/empleado/compras/canal-directo", label: "Canal directo (res)", icon: Beef },
      { href: "/empleado/compras/cerdo", label: "Cerdo en canal", icon: PiggyBank },
      { href: "/empleado/compras/llegada-canales", label: "Llegada de canales", icon: Truck },
      { href: "/empleado/compras/pollo", label: "Pollo", icon: Bird },
      { href: "/empleado/compras/otros", label: "Otros productos", icon: Package },
      { href: "/empleado/compras/corte-directo", label: "Compra directa de corte", icon: Scissors },
    ],
  },
  {
    label: "Procesos",
    icon: Split,
    children: [
      { href: "/empleado/desposte", label: "Desposte", icon: Scissors },
      { href: "/empleado/transferencias", label: "Transferencia de cortes", icon: ArrowLeftRight },
      { href: "/empleado/sub-desposte", label: "Sub-desposte", icon: Split },
    ],
  },
  { href: "/empleado/gastos", label: "Gastos y salidas", icon: Wallet },
  { href: "/empleado/clientes", label: "Clientes", icon: Users },
  { href: "/empleado/proveedores", label: "Proveedores", icon: Truck },
];

function isActive(pathname: string, href: string): boolean {
  if (href === ADMIN_HOME || href === EMPLOYEE_HOME) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function groupActive(pathname: string, g: Group): boolean {
  return g.children.some((c) => isActive(pathname, c.href));
}

export function AppNav({ role, fullName }: { role: Role; fullName: string }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const home = role === "admin" ? ADMIN_HOME : EMPLOYEE_HOME;
  const desktop = role === "admin" ? ADMIN_NAV : CASHIER_DESKTOP;
  const mobile = role === "admin" ? ADMIN_NAV : CASHIER_MOBILE;

  return (
    <>
      {/* ── Barra lateral (PC) ────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15%] flex-col border-r border-border bg-card lg:flex">
        <Link href={home} className="flex items-center gap-2.5 px-4 py-5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-[var(--shadow-brand)]">
            M
          </span>
          <span className="truncate text-[15px] font-bold tracking-tight text-foreground">
            {PRODUCT_NAME}
          </span>
        </Link>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <AccordionNav entries={desktop} pathname={pathname} variant="desktop" />
        </nav>

        <SidebarFooter fullName={fullName} />
      </aside>

      {/* ── Barra inferior (móvil) ────────────────────────────────────── */}
      <MobileBar home={home} onMenu={() => setDrawerOpen(true)} />

      {/* ── Drawer de módulos (móvil) ─────────────────────────────────── */}
      {drawerOpen && (
        <MobileDrawer
          entries={mobile}
          pathname={pathname}
          fullName={fullName}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}

// ── Renderizador de menús con submenús (acordeón) ──────────────────────────
function AccordionNav({
  entries,
  pathname,
  variant,
  onNavigate,
}: {
  entries: Entry[];
  pathname: string;
  variant: "desktop" | "drawer";
  onNavigate?: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const e of entries) {
      if (isGroup(e) && groupActive(pathname, e)) s.add(e.label);
    }
    return s;
  });

  const toggle = (label: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const isDesktop = variant === "desktop";
  const rowBase = isDesktop
    ? "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors"
    : "flex items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium transition-colors";
  const childBase = isDesktop
    ? "flex items-center gap-3 rounded-xl py-2 pl-9 pr-3 text-[13px] font-medium transition-colors"
    : "flex items-center gap-3 rounded-2xl py-2.5 pl-9 pr-3 text-[14.5px] font-medium transition-colors";
  const iconSize = isDesktop ? "size-[18px]" : "size-5";
  const childIconSize = isDesktop ? "size-4" : "size-[18px]";
  const inactiveRow = isDesktop
    ? "text-secondary-foreground hover:bg-secondary"
    : "text-foreground active:bg-secondary";

  return (
    <ul className="grid gap-1">
      {entries.map((entry) => {
        if (!isGroup(entry)) {
          const active = isActive(pathname, entry.href);
          const Icon = entry.icon;
          return (
            <li key={entry.href}>
              <Link
                href={entry.href}
                onClick={onNavigate}
                className={`${rowBase} ${
                  active ? "bg-primary text-primary-foreground" : inactiveRow
                }`}
              >
                <Icon className={`${iconSize} shrink-0`} strokeWidth={2} />
                <span className="truncate">{entry.label}</span>
              </Link>
            </li>
          );
        }

        const gActive = groupActive(pathname, entry);
        const open = expanded.has(entry.label);
        const Icon = entry.icon;
        return (
          <li key={entry.label}>
            <button
              type="button"
              onClick={() => toggle(entry.label)}
              className={`${rowBase} w-full ${
                gActive && !open
                  ? "text-primary"
                  : inactiveRow
              }`}
              aria-expanded={open}
            >
              <Icon className={`${iconSize} shrink-0`} strokeWidth={2} />
              <span className="flex-1 truncate text-left">{entry.label}</span>
              <ChevronDown
                className={`size-4 shrink-0 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>
            {open && (
              <ul className="mt-1 grid gap-1">
                {entry.children.map((c) => {
                  const active = isActive(pathname, c.href);
                  const CIcon = c.icon;
                  return (
                    <li key={c.href}>
                      <Link
                        href={c.href}
                        onClick={onNavigate}
                        className={`${childBase} ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : inactiveRow
                        }`}
                      >
                        <CIcon
                          className={`${childIconSize} shrink-0`}
                          strokeWidth={2}
                        />
                        <span className="truncate">{c.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SidebarFooter({ fullName }: { fullName: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="border-t border-border p-3">
      <p className="truncate px-2 pb-2 text-[13px] font-medium text-foreground">
        {fullName}
      </p>
      <Link
        href="/cambiar-clave"
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-secondary-foreground transition-colors hover:bg-secondary"
      >
        <KeyRound className="size-[18px]" />
        Cambiar contraseña
      </Link>
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

function MobileBar({ home, onMenu }: { home: string; onMenu: () => void }) {
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
  entries,
  pathname,
  fullName,
  onClose,
}: {
  entries: Entry[];
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
          <AccordionNav
            entries={entries}
            pathname={pathname}
            variant="drawer"
            onNavigate={onClose}
          />

          <div className="mt-4 border-t border-border pt-3">
            <p className="truncate px-3 pb-2 text-[13px] font-medium text-foreground">
              {fullName}
            </p>
            <Link
              href="/cambiar-clave"
              onClick={onClose}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-[15px] font-medium text-foreground active:bg-secondary"
            >
              <KeyRound className="size-5" />
              Cambiar contraseña
            </Link>
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
