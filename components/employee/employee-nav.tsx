"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine, ShoppingCart, Scissors, Package } from "lucide-react";

const ITEMS = [
  { href: "/empleado/pos", label: "POS", icon: ScanLine, ready: true },
  { href: "/empleado/compras", label: "Compras", icon: ShoppingCart, ready: true },
  { href: "/empleado/desposte", label: "Desposte", icon: Scissors, ready: true },
  { href: "/empleado/inventario", label: "Inventario", icon: Package, ready: false },
];

export function EmployeeNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map(({ href, label, icon: Icon, ready }) => {
          const active = pathname.startsWith(href);
          const cls = active ? "text-primary" : "text-text-tertiary";
          const content = (
            <span className="flex flex-col items-center gap-1 py-2.5 transition-transform active:scale-95">
              <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium tracking-wide">
                {label}
              </span>
            </span>
          );
          return (
            <li key={label} className="flex-1 text-center">
              {ready ? (
                <Link href={href} className={cls}>
                  {content}
                </Link>
              ) : (
                <span className="block cursor-not-allowed text-text-tertiary/50">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
