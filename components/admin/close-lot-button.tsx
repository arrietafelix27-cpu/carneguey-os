"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { closeLotWithMerma } from "@/lib/actions/lots";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function CloseLotButton({
  lotId,
  lotCode,
  remainingKg,
}: {
  lotId: string;
  lotCode: string;
  remainingKg: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const r = await closeLotWithMerma(lotId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Lote ${lotCode} finalizado`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        className="h-10 w-full"
        onClick={() => setOpen(true)}
      >
        Finalizar lote
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar lote {lotCode}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-secondary-foreground">
            Se enviarán{" "}
            <span className="font-semibold text-foreground">
              {remainingKg} kg
            </span>{" "}
            a merma definitiva y el lote pasará a cerrado. Esta acción no se
            puede deshacer.
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Volver
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={run}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
