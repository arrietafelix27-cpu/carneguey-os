import Link from "next/link";
import { Boxes, ChevronRight } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminAlerts } from "@/lib/admin-alerts";
import { AdminAlertsPanel } from "@/components/admin/admin-alerts-panel";

export const metadata = { title: "Panel · Carnegüey OS" };
export const dynamic = "force-dynamic";

const MODULES = [
  {
    href: "/admin/operaciones",
    label: "Productos y procesos",
    desc: "Inventario, compras y despostes",
    icon: Boxes,
  },
];

export default async function AdminDashboard() {
  const profile = await getCurrentProfile();
  const firstName = profile.full_name.split(" ")[0];
  const supabase = await createClient();
  const alerts = await getAdminAlerts(supabase);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Panel de administración</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Hola, {firstName}
        </h1>
      </header>

      <AdminAlertsPanel alerts={alerts} />

      <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Módulos
      </h2>
      <ul className="overflow-hidden rounded-3xl bg-card">
        {MODULES.map(({ href, label, desc, icon: Icon }, i) => (
          <li
            key={label}
            className={i > 0 ? "border-t border-border/60" : undefined}
          >
            <Link
              href={href}
              className="flex items-center gap-4 px-5 py-5 transition-colors active:bg-secondary"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <Icon className="size-6" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-foreground">
                  {label}
                </span>
                <span className="block text-sm text-muted-foreground">
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
