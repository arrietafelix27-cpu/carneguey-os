"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { reviewCashOutflow } from "@/lib/actions/cash-outflows";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function OutflowReview({
  outflowId,
  summary,
}: {
  outflowId: string;
  summary: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | "approve" | "reject">(null);

  function run(approve: boolean) {
    startTransition(async () => {
      const r = await reviewCashOutflow(outflowId, approve);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(approve ? "Egreso aprobado" : "Egreso rechazado");
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
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {confirm === "approve" ? "Aprobar egreso" : "Rechazar egreso"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-secondary-foreground">
            {confirm === "approve" ? (
              <>
                {summary}. Al aprobarlo, descuenta del efectivo esperado en el
                cuadre del día.
              </>
            ) : (
              <>
                El egreso quedará rechazado y no afectará el cuadre del día.
              </>
            )}
          </p>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setConfirm(null)}
              disabled={isPending}
            >
              Volver
            </Button>
            <Button
              className="gap-2"
              variant={confirm === "reject" ? "destructive" : "default"}
              disabled={isPending}
              onClick={() => run(confirm === "approve")}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
