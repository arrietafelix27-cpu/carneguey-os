import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAllProviders } from "@/lib/cache";
import { formatKg } from "@/lib/format";

export const metadata = { title: "Promedios por lote" };

const TYPE_LABEL: Record<string, string> = {
  beef_live: "Res",
  beef_carcass: "Res en canal",
  pork_carcass: "Cerdo",
};

export default async function LotesAnaliticaPage() {
  const supabase = await createClient();

  const [{ data: lots }, providers] = await Promise.all([
    supabase
      .from("v_lot_summary")
      .select(
        "lot_id, lot_code, type, status, provider_id, carcass_count, carcass_weight_kg, kg_despostado, created_at",
      )
      .in("status", ["active", "closed"]),
    getAllProviders(),
  ]);

  const providerName = new Map(providers.map((p) => [p.id, p.name]));

  const rows = (lots ?? [])
    .map((l) => {
      const count = Number(l.carcass_count ?? 0);
      const weight = Number(l.carcass_weight_kg ?? 0);
      return {
        lotId: l.lot_id as string,
        lotCode: l.lot_code as string,
        type: l.type as string,
        provider: providerName.get(l.provider_id as string) ?? "Proveedor",
        count,
        avgPerAnimal: count > 0 ? weight / count : 0,
        despostado: Number(l.kg_despostado ?? 0),
        createdAt: l.created_at as string,
      };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link
        href="/admin/analitica"
        className="mb-5 inline-flex items-center gap-1 text-[15px] font-medium text-primary transition-opacity active:opacity-60"
      >
        <ChevronLeft className="size-4" />
        Analítica
      </Link>

      <h1 className="mb-1 text-3xl font-bold tracking-tight text-foreground">
        Promedios por lote
      </h1>
      <p className="mb-7 text-sm text-muted-foreground">
        Cuánto rinde cada animal y qué cortes salieron. Toca un lote para ver
        el detalle.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-card shadow-sm px-6 py-16 text-center text-sm text-muted-foreground">
          Aún no hay lotes recibidos.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => (
            <li key={l.lotId}>
              <Link
                href={`/admin/lotes/${l.lotId}`}
                className="block rounded-2xl bg-card shadow-sm px-5 py-4 transition-colors active:bg-secondary"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {l.lotCode}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {TYPE_LABEL[l.type] ?? "Lote"} · {l.provider}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground/60" />
                </div>
                <div className="mt-3 flex gap-6">
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                      {l.count}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {l.type === "pork_carcass" ? "cerdos" : "reses"}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                      {formatKg(l.avgPerAnimal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      kg promedio c/u
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
