import Link from "next/link";
import { ChevronLeft, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { bogotaToday } from "@/lib/dates";
import { getActivity } from "@/lib/activity";
import {
  ActivityFeed,
  type ActivityPerson,
} from "@/components/admin/activity-feed";

export const metadata = { title: "Actividad" };
export const dynamic = "force-dynamic";

function defaultFrom(): string {
  const d = new Date(`${bogotaToday()}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const from = sp.from || defaultFrom();
  const to = sp.to || bogotaToday();
  const userId = sp.user || "";
  const onlyUnsupervised = sp.solo === "1";

  const supabase = await createClient();

  const [{ data: profiles }, events] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name", { ascending: true }),
    getActivity(supabase, {
      from,
      to,
      userId: userId || undefined,
      onlyUnsupervised,
    }),
  ]);

  const people: ActivityPerson[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    name: p.full_name as string,
    role: p.role as "admin" | "employee",
  }));

  const unsupervisedCount = events.filter((e) => e.unsupervised).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-9">
      <Link
        href="/admin"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground">
        Actividad
      </h1>
      <p className="mb-6 mt-1 text-[15px] leading-snug text-secondary-foreground">
        Todo lo que hizo tu equipo, con nombre y hora. Nada de esto se puede
        borrar ni editar.
      </p>

      {!onlyUnsupervised && unsupervisedCount > 0 && (
        <Link
          href={`/admin/actividad?from=${from}&to=${to}${
            userId ? `&user=${userId}` : ""
          }&solo=1`}
          className="mb-6 flex items-center gap-3 rounded-2xl bg-[var(--brand-red-soft)] px-4 py-3.5 text-primary transition-opacity active:opacity-70"
        >
          <ShieldAlert className="size-5 shrink-0" />
          <span className="text-[14px] font-medium">
            {unsupervisedCount}{" "}
            {unsupervisedCount === 1
              ? "acción delicada se hizo sin tu aprobación"
              : "acciones delicadas se hicieron sin tu aprobación"}
            . Ver solo esas.
          </span>
        </Link>
      )}

      <ActivityFeed
        events={events}
        people={people}
        from={from}
        to={to}
        userId={userId}
        onlyUnsupervised={onlyUnsupervised}
        todayLabel={format(new Date(`${bogotaToday()}T12:00:00`), "dd/MM/yyyy")}
      />
    </main>
  );
}
