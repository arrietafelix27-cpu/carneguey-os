"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, Scissors, Package } from "lucide-react";

const ITEMS = [
  { href: "/empleado/compras", label: "Compras", icon: ShoppingCart, ready: true },
  { href: "/empleado/desposte", label: "Desposte", icon: Scissors, ready: true },
  { href: "/empleado/inventario", label: "Inventario", icon: Package, ready: false },
];

export function EmployeeNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map(({ href, label, icon: Icon, ready }) => {
          const active = pathname.startsWith(href);
          const cls = active ? "text-primary" : "text-muted-foreground";
          const content = (
            <span className="flex flex-col items-center gap-1 py-2.5">
              <Icon className="size-5" />
              <span className="text-xs font-medium">{label}</span>
            </span>
          );
          return (
            <li key={label} className="flex-1 text-center">
              {ready ? (
                <Link href={href} className={cls}>
                  {content}
                </Link>
              ) : (
                <span className="block cursor-not-allowed text-muted-foreground/40">
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
