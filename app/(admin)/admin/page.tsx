import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminAlerts } from "@/lib/admin-alerts";
import { AdminAlertsPanel } from "@/components/admin/admin-alerts-panel";

export const metadata = { title: "Panel · Carnegüey OS" };
export const dynamic = "force-dynamic";

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
    </main>
  );
}
