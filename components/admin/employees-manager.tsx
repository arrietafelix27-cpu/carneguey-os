"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Search, ChevronRight } from "lucide-react";
import { formatCOP } from "@/lib/format";
import {
  createEmployee,
  updateEmployee,
  setEmployeeActive,
} from "@/lib/actions/employees";
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

export type EmployeeRow = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  salary: number;
  active: boolean;
};

type FormState = {
  name: string;
  role: string;
  phone: string;
  salary: string;
};

const EMPTY: FormState = { name: "", role: "", phone: "", salary: "" };

export function EmployeesManager({
  initialEmployees,
}: {
  initialEmployees: EmployeeRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialEmployees.filter(
      (e) => q === "" || e.name.toLowerCase().includes(q),
    );
  }, [initialEmployees, query]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }

  function openEdit(e: EmployeeRow) {
    setEditing(e);
    setForm({
      name: e.name,
      role: e.role ?? "",
      phone: e.phone ?? "",
      salary: e.salary > 0 ? String(e.salary) : "",
    });
    setDialogOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const r = editing
        ? await updateEmployee(editing.id, form)
        : await createEmployee(form);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(editing ? "Empleado actualizado" : "Empleado creado");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function toggleActive(e: EmployeeRow) {
    startTransition(async () => {
      const r = await setEmployeeActive(e.id, !e.active);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(e.active ? "Empleado desactivado" : "Empleado activado");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-bold tracking-tight text-foreground">
          Empleados
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
          placeholder="Buscar empleado"
          className="pl-11"
          inputMode="search"
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-3xl bg-card px-6 py-12 text-center text-[15px] text-secondary-foreground shadow-sm">
          Aún no hay empleados registrados.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-3xl bg-card shadow-sm">
          {visible.map((e, i) => (
            <li
              key={e.id}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <Link href={`/admin/empleados/${e.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {e.name}
                  {!e.active && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                      Inactivo
                    </span>
                  )}
                </p>
                <p className="text-[13px] text-secondary-foreground">
                  {e.role ?? "Sin cargo"}
                  {e.phone ? ` · ${e.phone}` : ""}
                </p>
              </Link>

              <div className="shrink-0 text-right">
                <p className="font-semibold text-foreground tabular-nums">
                  {formatCOP(e.salary)}
                </p>
                <p className="text-xs text-muted-foreground">salario</p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEdit(e)}
                aria-label={`Editar ${e.name}`}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant={e.active ? "secondary" : "default"}
                size="sm"
                disabled={isPending}
                onClick={() => toggleActive(e)}
              >
                {e.active ? "Desactivar" : "Activar"}
              </Button>
              <Link
                href={`/admin/empleados/${e.id}`}
                aria-label={`Ver ${e.name}`}
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
              {editing ? "Editar empleado" : "Nuevo empleado"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ename">Nombre</Label>
              <Input
                id="ename"
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="erole">Cargo</Label>
                <Input
                  id="erole"
                  placeholder="Carnicero, Cajera…"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ephone">Teléfono</Label>
                <Input
                  id="ephone"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="esalary">Salario</Label>
              <Input
                id="esalary"
                inputMode="numeric"
                placeholder="$"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
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
