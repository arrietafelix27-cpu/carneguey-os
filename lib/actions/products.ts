"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/auth";
import { productSchema } from "@/lib/validations/product";

type Result = { ok: true } | { error: string };

export async function createProduct(values: unknown): Promise<Result> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { error: "Revisa los datos del producto" };

  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.from("products").insert({
    name: parsed.data.name,
    category: parsed.data.category,
    unit: parsed.data.unit,
    origin: parsed.data.origin,
    pos_code: parsed.data.pos_code ? parsed.data.pos_code : null,
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un producto con ese código POS"
          : "No se pudo crear el producto",
    };
  }

  revalidatePath("/admin/productos");
  return { ok: true };
}

export async function updateProduct(
  id: string,
  values: unknown,
): Promise<Result> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { error: "Revisa los datos del producto" };

  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      category: parsed.data.category,
      unit: parsed.data.unit,
      origin: parsed.data.origin,
      pos_code: parsed.data.pos_code ? parsed.data.pos_code : null,
    })
    .eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un producto con ese código POS"
          : "No se pudo guardar el producto",
    };
  }

  revalidatePath("/admin/productos");
  return { ok: true };
}

export async function setProductActive(
  id: string,
  active: boolean,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("products")
    .update({ active })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el producto" };

  revalidatePath("/admin/productos");
  return { ok: true };
}
