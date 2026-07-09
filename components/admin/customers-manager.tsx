"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Search, ChevronRight } from "lucide-react";
import { formatCOP } from "@/lib/format";
import {
  createCustomer,
  updateCustomer,
  setCustomerActive,
} from "@/lib/actions/customers";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export type DiscountType = "percentage" | "fixed_per_product" | null;

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  discount_type: DiscountType;
  discount_value: number;
  credit_limit: number;
  active: boolean;
  notes: string | null;
  balance: number;
};

type FormState = {
  name: string;
  phone: string;
  discount_type: "" | "percentage" | "fixed_per_product";
  discount_value: string;
  credit_limit: string;
  notes: string;
};

const EMPTY: FormState = {
  name: "",
  phone: "",
  discount_type: "",
  discount_value: "",
  credit_limit: "",
  notes: "",
};

const DISCOUNT_LABEL: Record<string, string> = {
  "": "Sin descuento",
  percentage: "Porcentaje",
  fixed_per_product: "Valor fijo por producto",
};

export function describeDiscount(c: {
  discount_type: DiscountType;
  discount_value: number;
}): string {
  if (!c.discount_type || c.discount_value <= 0) return "Sin descuento";
  return c.discount_type === "percentage"
    ? `${c.discount_value}% de descuento`
    : `${formatCOP(c.discount_value)} menos por kg/u`;
}

export function CustomersManager({
  initialCustomers,
}: {
  initialCustomers: CustomerRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialCustomers.filter(
      (c) => q === "" || c.name.toLowerCase().includes(q),
    );
  }, [initialCustomers, query]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(c: CustomerRow) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      discount_type: c.discount_type ?? "",
      discount_value: c.discount_value > 0 ? String(c.discount_value) : "",
      credit_limit: c.credit_limit > 0 ? String(c.credit_limit) : "",
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const r = editing
        ? await updateCustomer(editing.id, form)
        : await createCustomer(form);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(editing ? "Cliente actualizado" : "Cliente creado");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function toggleActive(c: CustomerRow) {
    startTransition(async () => {
      const r = await setCustomerActive(c.id, !c.active);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(c.active ? "Cliente desactivado" : "Cliente activado");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">
          Clientes
        </h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-text-tertiary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente"
          className="pl-11"
          inputMode="search"
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
          Aún no hay clientes registrados.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {visible.map((c, i) => (
            <li
              key={c.id}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <Link href={`/admin/clientes/${c.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {c.name}
                  {!c.active && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                      Inactivo
                    </span>
                  )}
                </p>
                <p className="text-[13px] text-secondary-foreground">
                  {describeDiscount(c)}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </Link>

              <div className="shrink-0 text-right">
                <p
                  className={`font-semibold tabular-nums ${
                    c.balance > 0 ? "text-danger" : "text-foreground"
                  }`}
                >
                  {formatCOP(c.balance)}
                </p>
                <p className="text-xs text-muted-foreground">saldo</p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEdit(c)}
                aria-label={`Editar ${c.name}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant={c.active ? "secondary" : "default"}
                size="sm"
                disabled={isPending}
                onClick={() => toggleActive(c)}
              >
                {c.active ? "Desactivar" : "Activar"}
              </Button>
              <Link
                href={`/admin/clientes/${c.id}`}
                aria-label={`Ver ${c.name}`}
                className="grid size-8 place-items-center text-text-tertiary"
              >
                <ChevronRight className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar cliente" : "Nuevo cliente"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cname">Nombre</Label>
              <Input
                id="cname"
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="cphone">Teléfono (opcional)</Label>
                <Input
                  id="cphone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="climit">Cupo de crédito</Label>
                <Input
                  id="climit"
                  inputMode="numeric"
                  placeholder="$"
                  value={form.credit_limit}
                  onChange={(e) =>
                    setForm({ ...form, credit_limit: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Tipo de descuento</Label>
              <Select
                value={form.discount_type}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    discount_type: (v ?? "") as FormState["discount_type"],
                  })
                }
              >
                <SelectTrigger>
                  <span>{DISCOUNT_LABEL[form.discount_type]}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin descuento</SelectItem>
                  <SelectItem value="percentage">Porcentaje</SelectItem>
                  <SelectItem value="fixed_per_product">
                    Valor fijo por producto
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.discount_type !== "" && (
              <div className="grid gap-2">
                <Label htmlFor="cdisc">
                  {form.discount_type === "percentage"
                    ? "Porcentaje (%)"
                    : "Valor a restar por kg/unidad"}
                </Label>
                <Input
                  id="cdisc"
                  inputMode={
                    form.discount_type === "percentage" ? "decimal" : "numeric"
                  }
                  placeholder={
                    form.discount_type === "percentage" ? "0" : "$"
                  }
                  value={form.discount_value}
                  onChange={(e) =>
                    setForm({ ...form, discount_value: e.target.value })
                  }
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="cnotes">Notas (opcional)</Label>
              <Textarea
                id="cnotes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button className="gap-2" disabled={isPending} onClick={submit}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Guardar" : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
