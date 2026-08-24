"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { configureProductScale } from "@/lib/actions/scale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export type ScaleProduct = {
  id: string;
  name: string;
  pos_code: string | null;
};

/**
 * Configura el código de báscula de un producto. Flujo:
 *  - Escribe el código del producto (el mismo PLU de tu báscula).
 *  - Pesa el producto y escanea el ticket.
 *  - La PRIMERA vez del negocio, además confirma el peso que muestra la
 *    báscula: con eso el sistema aprende el formato y ya no lo vuelve a pedir.
 */
export function ScaleConfigDialog({
  product,
  hasPattern,
  onClose,
}: {
  product: ScaleProduct | null;
  hasPattern: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [barcode, setBarcode] = useState("");
  const [weight, setWeight] = useState("");

  useEffect(() => {
    if (product) {
      setCode(product.pos_code ?? "");
      setBarcode("");
      setWeight("");
    }
  }, [product]);

  function submit() {
    if (!product) return;
    const weightKg = Number(weight.replace(",", "."));
    startTransition(async () => {
      const r = await configureProductScale({
        productId: product.id,
        posCode: code.trim(),
        barcode: barcode.trim(),
        weightKg: hasPattern
          ? undefined
          : Number.isFinite(weightKg)
            ? weightKg
            : null,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Código de báscula configurado");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={product !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Báscula · {product?.name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sc-code">Código del producto</Label>
            <Input
              id="sc-code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: 302"
            />
            <p className="text-[12px] text-secondary-foreground">
              El mismo código (PLU) que este producto tiene en tu báscula.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sc-scan">Escanea el ticket de la báscula</Label>
            <Input
              id="sc-scan"
              autoFocus
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Pesa el producto y escanea aquí…"
            />
          </div>

          {!hasPattern && (
            <div className="grid gap-2">
              <Label htmlFor="sc-weight">
                Peso que muestra la báscula (kg)
              </Label>
              <Input
                id="sc-weight"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Ej: 0,445"
              />
              <p className="text-[12px] text-secondary-foreground">
                Solo la primera vez: con esto el sistema aprende el formato de
                tu báscula y ya no lo vuelve a pedir.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button className="gap-2" disabled={isPending} onClick={submit}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
