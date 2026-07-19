"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const today = () => new Date().toISOString().slice(0, 10);

export function PaymentMethodField({
  value,
  onChange,
  dueDate,
  onDueDateChange,
}: {
  value: "cash" | "credit";
  onChange: (v: "cash" | "credit") => void;
  dueDate: string;
  onDueDateChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>¿Cómo se paga?</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange((v as "cash" | "credit") ?? "cash")}
      >
        <SelectTrigger>
          <span>{value === "credit" ? "Crédito" : "Contado"}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cash">Contado</SelectItem>
          <SelectItem value="credit">Crédito</SelectItem>
        </SelectContent>
      </Select>

      {value === "credit" && (
        <div className="grid gap-2">
          <Label htmlFor="due_date">Fecha límite de pago (opcional)</Label>
          <Input
            id="due_date"
            type="date"
            min={today()}
            value={dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
