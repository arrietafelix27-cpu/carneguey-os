"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Scissors, ChevronRight } from "lucide-react";
import { formatKg } from "@/lib/format";
import { startDesposte } from "@/lib/actions/desposte";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ActiveLot = {
  id: string;
  lot_code: string;
  type: string;
  kg_remaining: number;
};

export type OngoingDesposte = {
  id: string;
  lot_code: string;
  input_weight_kg: number;
};

export function DesposteStart({
  ongoing,
  lots,
}: {
  ongoing: OngoingDesposte[];
  lots: ActiveLot[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ActiveLot | null>(null);
  const [weight, setWeight] = useState("");

  function start() {
    if (!selected) return;
    startTransition(async () => {
      const result = await startDesposte({
        lot_id: selected.id,
        input_weight_kg: weight,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.push(`/empleado/desposte/${result.desposteId}`);
    });
  }

  return (
    <div className="grid gap-6">
      {ongoing.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
            Despostes en curso
          </h2>
          <ul className="grid gap-3">
            {ongoing.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => router.push(`/empleado/desposte/${d.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card shadow-sm ring-1 ring-warning/40 p-4 text-left transition-transform active:scale-[0.98]"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <Scissors className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-foreground">
                      {d.lot_code}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Entró {formatKg(d.input_weight_kg)} kg · continuar
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
          Lotes disponibles para despostar
        </h2>
        {lots.length === 0 ? (
          <div className="rounded-2xl bg-card shadow-sm px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No hay lotes activos con peso disponible.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {lots.map((lot) => (
              <li
                key={lot.id}
                className="rounded-2xl bg-card shadow-sm p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {lot.lot_code}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Disponible: {formatKg(lot.kg_remaining)} kg
                    </p>
                  </div>
                  {selected?.id !== lot.id && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelected(lot);
                        setWeight("");
                      }}
                    >
                      Despostar
                    </Button>
                  )}
                </div>

                {selected?.id === lot.id && (
                  <div className="mt-4 grid gap-3 border-t border-border pt-4">
                    <div className="grid gap-2">
                      <Label htmlFor="w">
                        Peso que entra al desposte (kg)
                      </Label>
                      <Input
                        id="w"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        autoFocus
                      />
                      <p className="text-xs text-muted-foreground">
                        Máximo {formatKg(lot.kg_remaining)} kg.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setSelected(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="flex-1 gap-2"
                        disabled={isPending || weight.trim() === ""}
                        onClick={start}
                      >
                        {isPending && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        Iniciar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
