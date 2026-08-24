"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Loader2, Search, ScanLine } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  UNIT_LABELS,
  ORIGIN_LABELS,
  type Product,
  type Category,
} from "@/lib/catalog";
import { formatCOP } from "@/lib/format";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import {
  createProduct,
  updateProduct,
  setProductActive,
} from "@/lib/actions/products";
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
import {
  ScaleConfigDialog,
  type ScaleProduct,
} from "@/components/admin/scale-config-dialog";

type Filter = "all" | Category;

export function ProductsManager({
  initialProducts,
  hasScalePattern,
}: {
  initialProducts: Product[];
  hasScalePattern: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [scaleProduct, setScaleProduct] = useState<ScaleProduct | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: "beef",
      unit: "kg",
      origin: "from_processing",
      pos_code: "",
      shared_across_species: false,
    },
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialProducts.filter(
      (p) =>
        (filter === "all" || p.category === filter) &&
        (q === "" || p.name.toLowerCase().includes(q)),
    );
  }, [initialProducts, filter, query]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: visible.filter((p) => p.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [visible]);

  function openCreate() {
    setEditing(null);
    reset({
      name: "",
      category: "beef",
      unit: "kg",
      origin: "from_processing",
      pos_code: "",
      shared_across_species: false,
      price: "",
    });
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    reset({
      name: p.name,
      category: p.category,
      unit: p.unit,
      origin: p.origin,
      pos_code: p.pos_code ?? "",
      shared_across_species: p.shared_across_species ?? false,
      price: p.price != null ? String(p.price) : "",
    });
    setDialogOpen(true);
  }

  function onSubmit(values: ProductInput) {
    startTransition(async () => {
      const result = editing
        ? await updateProduct(editing.id, values)
        : await createProduct(values);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Producto actualizado" : "Producto agregado");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function toggleActive(p: Product) {
    startTransition(async () => {
      const result = await setProductActive(p.id, !p.active);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(p.active ? "Producto desactivado" : "Producto activado");
      router.refresh();
    });
  }

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORY_LABELS[c] })),
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Productos
        </h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          Agregar
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto"
          className="pl-9"
          inputMode="search"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === c.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-sm px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Ningún producto coincide.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ cat, items }) => (
            <section key={cat}>
              <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-secondary-foreground/70">
                {CATEGORY_LABELS[cat]} · {items.length}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-sm">
                {items.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {p.name}
                        {p.shared_across_species && (
                          <span className="ml-2 rounded-full bg-[var(--brand-red-soft)] px-2 py-0.5 text-xs font-medium text-primary">
                            Compartido
                          </span>
                        )}
                        {!p.active && (
                          <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                            Inactivo
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {UNIT_LABELS[p.unit]} · {ORIGIN_LABELS[p.origin]}
                        {p.pos_code ? ` · POS ${p.pos_code}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-foreground tabular-nums">
                        {p.price != null ? formatCOP(p.price) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">precio</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setScaleProduct({
                          id: p.id,
                          name: p.name,
                          pos_code: p.pos_code,
                        })
                      }
                      aria-label={`Configurar báscula de ${p.name}`}
                    >
                      <ScanLine className="size-4" />
                    </Button>
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
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar producto" : "Nuevo producto"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-4"
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="pname">Nombre</Label>
              <Input id="pname" {...register("name")} autoFocus />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Categoría</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <span>{CATEGORY_LABELS[field.value as Category]}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_ORDER.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Unidad</Label>
                <Controller
                  control={control}
                  name="unit"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <span>
                          {UNIT_LABELS[field.value as keyof typeof UNIT_LABELS]}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Kilogramos</SelectItem>
                        <SelectItem value="unit">Unidades</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid gap-2">
                <Label>Origen</Label>
                <Controller
                  control={control}
                  name="origin"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <span>
                          {
                            ORIGIN_LABELS[
                              field.value as keyof typeof ORIGIN_LABELS
                            ]
                          }
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="from_processing">
                          Sale de desposte
                        </SelectItem>
                        <SelectItem value="direct_purchase">
                          Compra directa
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="pos">Código POS (opcional)</Label>
                <Input id="pos" {...register("pos_code")} />
                {errors.pos_code && (
                  <p className="text-sm text-destructive">
                    {errors.pos_code.message}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Precio (COP)</Label>
                <Input
                  id="price"
                  inputMode="numeric"
                  placeholder="$"
                  {...register("price")}
                />
              </div>
            </div>

            <Controller
              control={control}
              name="shared_across_species"
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => field.onChange(!field.value)}
                  className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-left"
                >
                  <span
                    className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                      field.value ? "bg-primary" : "bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
                        field.value ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-foreground">
                      Compartido entre especies
                    </span>
                    <span className="block text-[13px] text-secondary-foreground">
                      Aparece en el desposte de res, cerdo y pollo
                    </span>
                  </span>
                </button>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Guardar" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ScaleConfigDialog
        product={scaleProduct}
        hasPattern={hasScalePattern}
        onClose={() => setScaleProduct(null)}
      />
    </div>
  );
}
