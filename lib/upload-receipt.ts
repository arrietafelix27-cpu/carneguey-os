import { createClient } from "@/lib/supabase/client";

/** Fases visibles del guardado de un registro con foto. */
export type UploadPhase =
  | "idle"
  | "compressing"
  | "uploading"
  | "saving"
  | "done";

export const PHASE_LABEL: Record<Exclude<UploadPhase, "idle">, string> = {
  compressing: "Preparando foto…",
  uploading: "Subiendo foto…",
  saving: "Guardando…",
  done: "¡Listo!",
};

/**
 * Sube la foto (ya comprimida) al bucket receipts desde el navegador, con la
 * sesión de la cajera (RLS is_active_user). Devuelve la ruta para que la acción
 * del servidor la indexe en la tabla receipts. El segmento intermedio de la
 * ruta es aleatorio: no depende del id de la entidad (que aún no existe).
 */
export async function uploadReceiptPhoto(
  file: File,
  entityType: "purchase_lot" | "cash_outflow" | "payroll_payment",
): Promise<string> {
  const supabase = createClient();
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${entityType}/${crypto.randomUUID()}_${safe}`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return path;
}
