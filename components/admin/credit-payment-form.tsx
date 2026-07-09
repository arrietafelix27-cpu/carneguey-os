"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { registerCreditPayment } from "@/lib/actions/customers";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
};

export function CreditPaymentForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const r = await registerCreditPayment({
        customer_id: customerId,
        sale_id: null,
        amount,
        payment_method: method,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Abono registrado");
      setOpen(false);
      setAmount("");
      router.refresh();
    });
  }

  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Registrar abono
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Monto</Label>
              <Input
                id="amount"
                autoFocus
                inputMode="numeric"
                placeholder="$"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-right text-[18px] font-semibold"
              />
            </div>
            <div className="grid gap-2">
              <Label>Método</Label>
              <Select value={method} onValueChange={(v) => setMethod(v ?? "cash")}>
                <SelectTrigger>
                  <span>{METHOD_LABEL[method]}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={submit}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
