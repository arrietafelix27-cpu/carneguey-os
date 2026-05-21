"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";
import { resetTestData } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function ResetDataButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await resetTestData();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Datos de inventario borrados. Todo quedó en cero.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Resetear datos de prueba
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-destructive" />
              ¿Estás seguro?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esto borrará todos los datos de inventario — lotes, despostes,
            compras, movimientos, conteos y comprobantes — y no se puede
            deshacer. Los productos, proveedores y usuarios NO se tocan.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={isPending}
              onClick={run}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Sí, borrar todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
