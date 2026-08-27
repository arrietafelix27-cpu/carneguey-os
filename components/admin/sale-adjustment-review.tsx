"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { reviewSaleAdjustment } from "@/lib/actions/sale-adjustments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function SaleAdjustmentReview({
  adjustmentId,
  summary,
}: {
  adjustmentId: string;
  summary: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | "approve" | "reject">(null);

  function run(approve: boolean) {
    startTransition(async () => {
      const r = await reviewSaleAdjustment(adjustmentId, approve);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(approve ? "Aprobado" : "Rechazado");
      setConfirm(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="h-10 flex-1 gap-1.5"
          disabled={isPending}
          onClick={() => setConfirm("reject")}
        >
          <X className="size-4" />
          Rechazar
        </Button>
        <Button
          className="h-10 flex-1 gap-1.5"
          disabled={isPending}
          onClick={() => setConfirm("approve")}
        >
          <Check className="size-4" />
          Aprobar
        </Button>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirm === "approve" ? "¿Aprobar?" : "¿Rechazar?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[15px] leading-snug text-secondary-foreground">
            {summary}
          </p>
          {confirm === "approve" && (
            <p className="text-[14px] leading-snug text-foreground">
              Al aprobar se aplica de inmediato: se mueve el inventario y la
              caja. No se puede deshacer.
            </p>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              className="gap-2"
              disabled={isPending}
              onClick={() => run(confirm === "approve")}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {confirm === "approve" ? "Sí, aprobar" : "Sí, rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
