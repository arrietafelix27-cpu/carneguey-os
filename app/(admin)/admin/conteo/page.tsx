import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { StartCountButton } from "@/components/admin/start-count-button";

export const metadata = { title: "Conteo quincenal · Carnegüey OS" };

export default async function ConteoIndexPage() {
  const supabase = await createClient();
  const { data: counts } = await supabase
    .from("physical_counts")
    .select("id, status, count_date, completed_at, created_at")
    .order("created_at", { ascending: false });

  const inProgress = (counts ?? []).find((c) => c.status === "in_progress");
  const completed = (counts ?? []).filter((c) => c.status === "completed");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ChevronLeft className="size-4" />
        Panel
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Conteo quincenal
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Ingresa lo que se vendió y la app te dice cuánto debe quedar.
      </p>

      <div className="mb-6">
        {inProgress ? (
          <Link
            href={`/admin/conteo/${inProgress.id}`}
            className="flex items-center gap-4 rounded-xl border border-warning/40 bg-card p-4 transition-transform active:scale-[0.98]"
          >
            <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
              <ClipboardCheck className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-foreground">
                Conteo en curso
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

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Conteos anteriores
      </h2>
      {completed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Aún no has cerrado ningún conteo.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {completed.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/conteo/${c.id}`}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <span className="flex-1 font-medium text-foreground">
                  Conteo del{" "}
                  {format(
                    new Date((c.completed_at ?? c.created_at) as string),
                    "dd/MM/yyyy",
                  )}
                </span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
