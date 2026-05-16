"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Camera } from "lucide-react";
import type { Provider } from "@/lib/catalog";
import { createCarcassLot } from "@/lib/actions/lots";
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

export function CarcassLotForm({
  type,
  providers,
}: {
  type: "beef_carcass" | "pork_carcass";
  providers: Provider[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [providerId, setProviderId] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const noun = type === "beef_carcass" ? "canales" : "cerdos";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("type", type);
    fd.set("provider_id", providerId);

    startTransition(async () => {
      const result = await createCarcassLot(fd);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Lote ${result.lotCode} registrado`);
      router.push("/empleado/compras");
    });
  }

  const selectedProvider = providers.find((p) => p.id === providerId);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-5" noValidate>
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
          <Label htmlFor="count">N° de {noun}</Label>
          <Input
            id="count"
            name="carcass_count"
            inputMode="numeric"
            placeholder="0"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="weight">Peso total (kg)</Label>
          <Input
            id="weight"
            name="carcass_weight_kg"
            inputMode="decimal"
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="cost">Costo total pagado</Label>
        <Input
          id="cost"
          name="carcass_purchase_cost"
          inputMode="numeric"
          placeholder="$"
        />
        <p className="text-xs text-muted-foreground">
          Este dato lo necesita Félix. Tú no lo verás después de guardar.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="arrival">Fecha de llegada</Label>
        <Input
          id="arrival"
          name="arrival_date"
          type="date"
          defaultValue={today()}
          max={today()}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="photo">Foto del comprobante (obligatoria)</Label>
        <label
          htmlFor="photo"
          className="flex cursor-pointer items-center gap-3 rounded-md border border-input bg-secondary px-4 py-3 text-sm"
        >
          <Camera className="size-5 text-muted-foreground" />
          <span className="truncate text-muted-foreground">
            {fileName ?? "Tomar foto o elegir archivo"}
          </span>
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
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
        Guardar lote
      </Button>
    </form>
  );
}
