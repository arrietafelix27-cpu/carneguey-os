"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/auth";
import { employeeSchema } from "@/lib/validations/employee";

type Result = { ok: true } | { error: string };

function parseMoney(raw: string | undefined): number {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  return digits === "" ? 0 : Number(digits);
}

function fields(d: {
  name: string;
  role?: string;
  phone?: string;
  salary?: string;
}) {
  return {
    name: d.name,
    role: d.role ? d.role : null,
    phone: d.phone ? d.phone : null,
    salary: parseMoney(d.salary),
  };
}

export async function createEmployee(values: unknown): Promise<Result> {
  const parsed = employeeSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase.from("employees").insert(fields(parsed.data));
  if (error) return { error: `No se pudo crear: ${error.message}` };

  revalidatePath("/admin/empleados");
  return { ok: true };
}

export async function updateEmployee(
  id: string,
  values: unknown,
): Promise<Result> {
  const parsed = employeeSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("employees")
    .update(fields(parsed.data))
    .eq("id", id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/admin/empleados");
  revalidatePath(`/admin/empleados/${id}`);
  return { ok: true };
}

export async function setEmployeeActive(
  id: string,
  active: boolean,
): Promise<Result> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  const { error } = await supabase
    .from("employees")
    .update({ active })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar el empleado" };

  revalidatePath("/admin/empleados");
  return { ok: true };
}
