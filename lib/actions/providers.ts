"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/auth";
import { providerSchema } from "@/lib/validations/provider";

type Result = { ok: true } | { error: string };

export async function createProvider(values: unknown): Promise<Result> {
  const parsed = providerSchema.safeParse(values);
  if (!parsed.success) return { error: "Revisa los datos del proveedor" };

  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  // type='other' interno: la columna sigue NOT NULL pero el negocio no la
  // usa (ver DECISIONS.md D-013).
  const { error } = await supabase.from("providers").insert({
    name: parsed.data.name,
    phone: parsed.data.phone ? parsed.data.phone : null,
    type: "other",
  });
  if (error) return { error: "No se pudo crear el proveedor" };

  revalidatePath("/admin/proveedores");
  return { ok: true };
}

export async function updateProvider(
  id: string,
  values: unknown,
): Promise<Result> {
  const parsed = providerSchema.safeParse(values);
  if (!parsed.success) return { error: "Revisa los datos del proveedor" };

  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("providers")
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone ? parsed.data.phone : null,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar el proveedor" };

  revalidatePath("/admin/proveedores");
  return { ok: true };
}

export async function setProviderActive(
  id: string,
  active: boolean,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("providers")
    .update({ active })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el proveedor" };

  revalidatePath("/admin/proveedores");
  return { ok: true };
}
