"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { reviewSubDesposte } from "@/lib/actions/sub-despostes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function SubDesposteReview({
  subId,
  summary,
}: {
  subId: string;
  summary: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | "approve" | "reject">(null);

  function run(approve: boolean) {
    startTransition(async () => {
      const r = await reviewSubDesposte(subId, approve);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(approve ? "Sub-desposte aprobado" : "Sub-desposte rechazado");
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "approve"
                ? "Aprobar sub-desposte"
                : "Rechazar sub-desposte"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-secondary-foreground">
            {confirm === "approve" ? (
              <>
                Se aplicará al inventario: {summary}. Esta acción no se puede
                deshacer.
              </>
            ) : (
              <>El sub-desposte quedará rechazado y el inventario no cambiará.</>
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
