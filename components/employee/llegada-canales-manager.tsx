"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Camera, Truck, CheckCircle2 } from "lucide-react";
import { registerLotArrival } from "@/lib/actions/lots";
import { compressImage } from "@/lib/compress-image";
import { PhotoDeviceHint } from "@/components/shared/photo-device-hint";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type PendingLot = {
  id: string;
  lot_code: string;
  provider_name: string;
  live_animal_count: number | null;
  live_purchase_date: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

export function LlegadaCanalesManager({
  lots,
  receiptRequired,
}: {
  lots: PendingLot[];
  receiptRequired: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const busy = phase !== "idle";
  const [active, setActive] = useState<PendingLot | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active || busy) return;
    const fd = new FormData(e.currentTarget);
    fd.set("lot_id", active.id);
    const lotCode = active.lot_code;
    const file = fd.get("photo");
    const hasPhoto = file instanceof File && file.size > 0;
    if (!hasPhoto && receiptRequired) {
      toast.error("La foto del comprobante es obligatoria");
      return;
    }

    (async () => {
      try {
        if (file instanceof File && file.size > 0) {
          setPhase("compressing");
          const compressed = await compressImage(file);
          setPhase("uploading");
          const path = await uploadReceiptPhoto(compressed, "purchase_lot");
          fd.set("photo_path", path);
        }
        fd.delete("photo");

        setPhase("saving");
        const result = await registerLotArrival(fd);
        if ("error" in result) {
          toast.error(result.error);
          setPhase("idle");
          return;
        }
        setPhase("done");
        toast.success(`Llegada del lote ${lotCode} registrada`);
        setTimeout(() => {
          setActive(null);
          setFileName(null);
          setPhase("idle");
          router.refresh();
        }, 600);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        console.error("Llegada: fallo al subir/guardar:", err);
        toast.error(`No se pudo guardar: ${msg}`);
        setPhase("idle");
      }
    })();
  }

  if (lots.length === 0) {
    return (
      <div className="rounded-2xl bg-card shadow-sm px-6 py-12 text-center">
        <Truck className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No hay lotes de ganado en pie pendientes de llegada.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="grid gap-3">
        {lots.map((lot) => (
          <li
            key={lot.id}
            className="rounded-2xl bg-card shadow-sm p-4"
          >
            <p className="font-semibold text-foreground">{lot.lot_code}</p>
            <p className="text-sm text-muted-foreground">
              {lot.provider_name}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {lot.live_animal_count ?? "?"} animales esperados
            </p>
            <Button
              className="mt-3 w-full"
              onClick={() => {
                setActive(lot);
                setFileName(null);
              }}
            >
              Registrar llegada
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!active}
        onOpenChange={(o) => {
          if (!o) setActive(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Llegada de canales · {active?.lot_code}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="cc">N° de canales</Label>
                <Input
                  id="cc"
                  name="carcass_count"
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cw">Peso total (kg)</Label>
                <Input
                  id="cw"
                  name="carcass_weight_kg"
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ad">Fecha de llegada</Label>
              <Input
                id="ad"
                name="arrival_date"
                type="date"
                defaultValue={today()}
                max={today()}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="photo">
                Foto del comprobante{" "}
                {receiptRequired ? "(obligatoria)" : "(opcional)"}
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
                onChange={(e) =>
                  setFileName(e.target.files?.[0]?.name ?? null)
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={busy} className="gap-2">
                {phase === "done" ? (
                  <CheckCircle2 className="size-5" />
                ) : busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {busy ? PHASE_LABEL[phase] : "Confirmar llegada"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
