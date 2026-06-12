import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { StartCountButton } from "@/components/admin/start-count-button";

export const metadata = { title: "Conteo quincenal · Carnegüey OS" };
export const dynamic = "force-dynamic";

const STATUS_META: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  in_progress: {
    label: "En progreso",
    bg: "bg-warning/15",
    text: "text-warning",
  },
  completed: {
    label: "Completado",
    bg: "bg-success/15",
    text: "text-success",
  },
  cancelled: {
    label: "Cancelado",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
};

export default async function ConteosListPage() {
  const supabase = await createClient();
  const { data: counts } = await supabase
    .from("physical_counts")
    .select("id, status, count_date, completed_at, created_at")
    .order("created_at", { ascending: false });

  const list = counts ?? [];
  const inProgress = list.find((c) => c.status === "in_progress");

  const countIds = list.map((c) => c.id as string);
  const itemCounts = new Map<string, number>();
  if (countIds.length > 0) {
    const { data: items } = await supabase
      .from("physical_count_items")
      .select("physical_count_id")
      .in("physical_count_id", countIds);
    for (const it of items ?? []) {
      const pid = it.physical_count_id as string;
      itemCounts.set(pid, (itemCounts.get(pid) ?? 0) + 1);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin/operaciones"
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Operaciones
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        Conteo quincenal
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Registro de ventas y conteo físico del inventario.
      </p>

      <div className="mb-7">
        {inProgress ? (
          <Link
            href="/admin/conteo/nuevo"
            className="flex items-center gap-4 rounded-2xl border border-warning/40 bg-card p-4 transition-colors active:bg-secondary"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
              <ClipboardCheck className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-foreground">
                Conteo en progreso
              </span>
              <span className="block text-sm text-muted-foreground">
                Continuar donde quedaste
              </span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        ) : (
          <StartCountButton />
        )}
      </div>

      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Historial
      </h2>
      {list.length === 0 ? (
        <div className="rounded-3xl bg-secondary px-6 py-10 text-center text-sm text-muted-foreground">
          Aún no hay conteos registrados.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card">
          {list.map((c, i) => {
            const status = c.status as string;
            const meta = STATUS_META[status] ?? STATUS_META.cancelled;
            const date = (c.completed_at ?? c.created_at) as string;
            const items = itemCounts.get(c.id as string) ?? 0;
            const href =
              status === "in_progress"
                ? "/admin/conteo/nuevo"
                : `/admin/conteos/${c.id}`;
            return (
              <li
                key={c.id as string}
                className={i > 0 ? "border-t border-border/60" : undefined}
              >
                <Link
                  href={href}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors active:bg-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      Conteo del {format(new Date(date), "dd/MM/yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {items} {items === 1 ? "producto" : "productos"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.bg} ${meta.text}`}
                  >
                    {meta.label}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
