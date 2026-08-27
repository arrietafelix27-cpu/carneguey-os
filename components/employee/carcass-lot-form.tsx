"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Camera, CheckCircle2 } from "lucide-react";
import type { Provider } from "@/lib/catalog";
import { createCarcassLot } from "@/lib/actions/lots";
import { PaymentMethodField } from "@/components/shared/payment-method-field";
import { compressImage } from "@/lib/compress-image";
import {
  uploadReceiptPhoto,
  PHASE_LABEL,
  type UploadPhase,
} from "@/lib/upload-receipt";
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
import { PhotoDeviceHint } from "@/components/shared/photo-device-hint";

const today = () => new Date().toISOString().slice(0, 10);

export function CarcassLotForm({
  type,
  providers,
  receiptRequired,
}: {
  type: "beef_carcass" | "pork_carcass" | "poultry_carcass";
  providers: Provider[];
  receiptRequired: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const busy = phase !== "idle";
  const [providerId, setProviderId] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">(
    "cash",
  );
  const [dueDate, setDueDate] = useState("");

  const noun =
    type === "beef_carcass"
      ? "canales"
      : type === "pork_carcass"
        ? "cerdos"
        : "pollos";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    fd.set("type", type);
    fd.set("provider_id", providerId);
    fd.set("payment_method", paymentMethod);
    fd.set("due_date", paymentMethod === "credit" ? dueDate : "");

    const file = fd.get("photo");
    const hasPhoto = file instanceof File && file.size > 0;
    if (!hasPhoto && receiptRequired) {
      toast.error("La foto del comprobante es obligatoria");
      return;
    }

    (async () => {
      try {
        fd.delete("photo");
        if (hasPhoto) {
          setPhase("compressing");
          const compressed = await compressImage(file);
          setPhase("uploading");
          const path = await uploadReceiptPhoto(compressed, "purchase_lot");
          fd.set("photo_path", path);
        }

        setPhase("saving");
        const result = await createCarcassLot(fd);
        if ("error" in result) {
          toast.error(result.error);
          setPhase("idle");
          return;
        }
        setPhase("done");
        toast.success(`Lote ${result.lotCode} registrado`);
        setTimeout(() => router.push("/empleado/compras"), 600);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        console.error("Lote: fallo al subir/guardar:", err);
        toast.error(`No se pudo guardar: ${msg}`);
        setPhase("idle");
      }
    })();
  }

  const selectedProvider = providers.find((p) => p.id === providerId);

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
          Este dato lo necesita la administración. Tú no lo verás después de
          guardar.
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
        <Label htmlFor="photo">
          Foto del comprobante {receiptRequired ? "(obligatoria)" : "(opcional)"}
        </Label>
        <PhotoDeviceHint required={receiptRequired} />
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

      <PaymentMethodField
        value={paymentMethod}
        onChange={setPaymentMethod}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
      />

      <Button
        type="submit"
        disabled={busy}
        className="h-12 w-full gap-2 text-base font-semibold transition-transform active:scale-[0.98]"
      >
        {phase === "done" ? (
          <CheckCircle2 className="size-5" />
        ) : busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : null}
        {busy ? PHASE_LABEL[phase] : "Guardar lote"}
      </Button>
    </form>
  );
}
