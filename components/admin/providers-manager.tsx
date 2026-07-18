"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Search, ChevronRight } from "lucide-react";
import { formatCOP } from "@/lib/format";
import type { Provider } from "@/lib/catalog";
import { providerSchema, type ProviderInput } from "@/lib/validations/provider";
import {
  createProvider,
  updateProvider,
  setProviderActive,
} from "@/lib/actions/providers";
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

export function ProvidersManager({
  initialProviders,
  balances,
}: {
  initialProviders: Provider[];
  balances: Record<string, number>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProviderInput>({
    resolver: zodResolver(providerSchema),
    defaultValues: { name: "", phone: "" },
  });

  const filtered = initialProviders.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function openCreate() {
    setEditing(null);
    reset({ name: "", phone: "" });
    setDialogOpen(true);
  }

  function openEdit(p: Provider) {
    setEditing(p);
    reset({ name: p.name, phone: p.phone ?? "" });
    setDialogOpen(true);
  }

  function onSubmit(values: ProviderInput) {
    startTransition(async () => {
      const result = editing
        ? await updateProvider(editing.id, values)
        : await createProvider(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Proveedor actualizado" : "Proveedor agregado");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function toggleActive(p: Provider) {
    startTransition(async () => {
      const result = await setProviderActive(p.id, !p.active);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(p.active ? "Proveedor desactivado" : "Proveedor activado");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Proveedores
        </h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar proveedor"
          className="pl-9"
          inputMode="search"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {initialProviders.length === 0
              ? "Aún no hay proveedores. Agrega el primero."
              : "Ningún proveedor coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-sm">
          {filtered.map((p) => {
            const pending = balances[p.id] ?? 0;
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <Link href={`/admin/proveedores/${p.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {p.name}
                    {!p.active && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                        Inactivo
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {p.phone || "Sin teléfono"}
                  </p>
                </Link>
                {pending > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-danger tabular-nums">
                      {formatCOP(pending)}
                    </p>
                    <p className="text-xs text-muted-foreground">pendiente</p>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(p)}
                  aria-label={`Editar ${p.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant={p.active ? "secondary" : "default"}
                  size="sm"
                  disabled={isPending}
                  onClick={() => toggleActive(p)}
                >
                  {p.active ? "Desactivar" : "Activar"}
                </Button>
                <Link
                  href={`/admin/proveedores/${p.id}`}
                  aria-label={`Ver cuenta de ${p.name}`}
                  className="grid size-8 place-items-center text-text-tertiary"
                >
                  <ChevronRight className="size-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar proveedor" : "Nuevo proveedor"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-4"
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" {...register("name")} autoFocus />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Teléfono (opcional)</Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="Ej: 300 123 4567"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Guardar" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
