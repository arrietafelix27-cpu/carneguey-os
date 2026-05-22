"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { updateMermaThresholds } from "@/lib/actions/settings";
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

export function MermaThresholdEditor({
  beef,
  pork,
}: {
  beef: number;
  pork: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [beefValue, setBeefValue] = useState(String(beef));
  const [porkValue, setPorkValue] = useState(String(pork));
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateMermaThresholds({
        beef: beefValue,
        pork: porkValue,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Umbrales actualizados");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setBeefValue(String(beef));
          setPorkValue(String(pork));
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
      >
        <SlidersHorizontal className="size-4" />
        Ajustar umbrales
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Umbrales de merma</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Por encima de este porcentaje, la merma se marca en rojo como
            anormal.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="th-beef">Res (%)</Label>
              <Input
                id="th-beef"
                inputMode="decimal"
                value={beefValue}
                onChange={(e) => setBeefValue(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="th-pork">Cerdo (%)</Label>
              <Input
                id="th-pork"
                inputMode="decimal"
                value={porkValue}
                onChange={(e) => setPorkValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={save}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
