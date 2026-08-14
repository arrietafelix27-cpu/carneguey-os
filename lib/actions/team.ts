"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminContext } from "@/lib/auth";
import { createTeamUserSchema } from "@/lib/validations/team";

type Result = { ok: true } | { error: string };

export type TeamMember = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "employee";
  active: boolean;
};

/** Lista el equipo (perfiles + email de Auth) de la organización. Solo admin. */
export async function listTeam(): Promise<TeamMember[]> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return [];

  // El cliente admin (service-role) salta la RLS, así que hay que filtrar por
  // la organización del admin a mano — si no, vería usuarios de otros negocios.
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return [];

  const admin = createAdminClient();

  const [{ data: authList }, { data: profiles }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("profiles")
      .select("id, full_name, role, active")
      .eq("organization_id", orgId)
      .order("full_name", { ascending: true }),
  ]);

  const emailById = new Map(
    (authList?.users ?? []).map((u) => [u.id, u.email ?? ""]),
  );

  const rows: TeamMember[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    email: emailById.get(p.id as string) ?? "",
    fullName: p.full_name as string,
    role: p.role as "admin" | "employee",
    active: p.active as boolean,
  }));

  // Activos primero, luego por nombre.
  return rows.sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.fullName.localeCompare(b.fullName, "es"),
  );
}

/** Crea un usuario con contraseña temporal (debe cambiarla en su 1er login). */
export async function createTeamUser(values: unknown): Promise<Result> {
  const parsed = createTeamUserSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  }
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  // El nuevo usuario hereda la organización del admin que lo crea. Nunca se
  // toma de un valor que mande el cliente.
  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { error: "No se pudo resolver tu organización" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      organization_id: orgId,
    },
  });

  if (error || !data.user) {
    const msg = error?.message ?? "";
    if (/registered|already/i.test(msg)) {
      return { error: "Ya existe un usuario con ese correo" };
    }
    return { error: `No se pudo crear el usuario: ${msg}` };
  }

  // El trigger creó el perfil desde user_metadata; marcamos el cambio forzado.
  const { error: profErr } = await admin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", data.user.id);
  if (profErr) {
    return {
      error: `Usuario creado, pero no se marcó el cambio de clave: ${profErr.message}`,
    };
  }

  revalidatePath("/admin/equipo");
  return { ok: true };
}

/** Activa/desactiva un usuario (no se borra). Bloquea su login si se desactiva. */
export async function setTeamUserActive(
  userId: string,
  active: boolean,
): Promise<Result> {
  const { isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "No autorizado" };

  // Evita que el admin se desactive a sí mismo y quede fuera.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && user.id === userId && !active) {
    return { error: "No puedes desactivar tu propia cuenta" };
  }

  const { data: orgId } = await supabase.rpc("current_org_id");
  if (!orgId) return { error: "No se pudo resolver tu organización" };

  const admin = createAdminClient();
  // Solo usuarios de MI organización (el service-role salta la RLS).
  const { data: updated, error: profErr } = await admin
    .from("profiles")
    .update({ active })
    .eq("id", userId)
    .eq("organization_id", orgId)
    .select("id")
    .maybeSingle();
  if (profErr) {
    return { error: `No se pudo actualizar: ${profErr.message}` };
  }
  if (!updated) {
    return { error: "Usuario no encontrado en tu organización" };
  }

  // Bloquea/desbloquea el login en Auth.
  await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
  });

  revalidatePath("/admin/equipo");
  return { ok: true };
}
