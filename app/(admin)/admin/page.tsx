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
    <main className="mx-auto max-w-2xl px-4 py-9">
      <header className="mb-8">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Panel de administración
        </p>
        <h1 className="mt-1 text-[34px] font-bold leading-tight tracking-tight text-foreground">
          Hola, {firstName}
        </h1>
      </header>

      <AdminAlertsPanel alerts={alerts} />

      <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
        Módulos
      </h2>
      <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
        {MODULES.map(({ href, label, desc, icon: Icon }, i) => (
          <li
            key={label}
            className={i > 0 ? "border-t border-border" : undefined}
          >
            <Link
              href={href}
              className="flex items-center gap-4 px-4 py-4 transition-colors active:bg-secondary"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-lg)] bg-[var(--brand-red-soft)] text-primary">
                <Icon className="size-6" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold text-foreground">
                  {label}
                </span>
                <span className="block text-[14px] text-secondary-foreground">
                  {desc}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-text-tertiary" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
