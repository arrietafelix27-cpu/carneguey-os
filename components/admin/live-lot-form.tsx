"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { Provider } from "@/lib/catalog";
import { createLiveLot } from "@/lib/actions/lots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const today = () => new Date().toISOString().slice(0, 10);

export function LiveLotForm({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [providerId, setProviderId] = useState("");

  const selectedProvider = providers.find((p) => p.id === providerId);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values = {
      provider_id: providerId,
      live_animal_count: fd.get("live_animal_count"),
      live_weight_kg: fd.get("live_weight_kg"),
      live_purchase_cost: fd.get("live_purchase_cost"),
      transport_to_slaughter_cost:
        fd.get("transport_to_slaughter_cost") || 0,
      slaughter_cost: fd.get("slaughter_cost") || 0,
      transport_to_shop_cost: fd.get("transport_to_shop_cost") || 0,
      other_costs: fd.get("other_costs") || 0,
      live_purchase_date: fd.get("live_purchase_date"),
      notes: fd.get("notes") ?? "",
    };

    startTransition(async () => {
      const result = await createLiveLot(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Lote ${result.lotCode} registrado`);
      router.push("/admin");
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <div className="grid gap-2">
        <Label>Proveedor</Label>
        <Select
          value={providerId}
          onValueChange={(v) => setProviderId(v ?? "")}
        >
          <SelectTrigger>
            <span className={selectedProvider ? "" : "text-muted-foreground"}>
              {selectedProvider?.name ?? "Selecciona un proveedor"}
            </span>
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="count">N° de animales</Label>
          <Input
            id="count"
            name="live_animal_count"
            inputMode="numeric"
            placeholder="0"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="weight">Peso vivo total (kg)</Label>
          <Input
            id="weight"
            name="live_weight_kg"
            inputMode="decimal"
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="cost">Precio pagado por el ganado</Label>
        <Input
          id="cost"
          name="live_purchase_cost"
          inputMode="numeric"
          placeholder="$"
        />
      </div>

      <div className="rounded-2xl bg-card shadow-sm p-4">
        <p className="mb-1 text-sm font-semibold text-foreground">
          Costos adicionales
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Si aún no los conoces, déjalos vacíos y los editas después.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Transporte al matadero</Label>
            <Input
              name="transport_to_slaughter_cost"
              inputMode="numeric"
              placeholder="0"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Sacrificio</Label>
            <Input
              name="slaughter_cost"
              inputMode="numeric"
              placeholder="0"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Transporte al negocio</Label>
            <Input
              name="transport_to_shop_cost"
              inputMode="numeric"
              placeholder="0"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Otros costos</Label>
            <Input name="other_costs" inputMode="numeric" placeholder="0" />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="date">Fecha de compra</Label>
        <Input
          id="date"
          name="live_purchase_date"
          type="date"
          defaultValue={today()}
          max={today()}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="h-12 w-full gap-2 text-base font-semibold transition-transform active:scale-[0.98]"
      >
        {isPending && <Loader2 className="size-4 animate-spin" />}
        Registrar lote
      </Button>
    </form>
  );
}
