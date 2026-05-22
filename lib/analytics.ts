import type { SupabaseClient } from "@supabase/supabase-js";

export type MermaThresholds = { beef: number; pork: number };

/** Lee los umbrales de merma; si faltan, usa los valores por defecto. */
export async function getMermaThresholds(
  supabase: SupabaseClient,
): Promise<MermaThresholds> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value");
  const map = new Map(
    (data ?? []).map((r) => [r.key as string, Number(r.value)]),
  );
  return {
    beef: map.get("merma_threshold_beef") ?? 8,
    pork: map.get("merma_threshold_pork") ?? 5,
  };
}

/** Umbral que aplica a un tipo de lote. */
export function thresholdFor(
  lotType: string,
  t: MermaThresholds,
): number {
  return lotType === "pork_carcass" ? t.pork : t.beef;
}

export type Status = "good" | "bad" | "neutral";

/** Clases de color para un indicador (verde bueno / rojo alerta / gris). */
export function statusClasses(status: Status): {
  text: string;
  bg: string;
  dot: string;
} {
  if (status === "good") {
    return { text: "text-success", bg: "bg-success/10", dot: "bg-success" };
  }
  if (status === "bad") {
    return { text: "text-danger", bg: "bg-danger/10", dot: "bg-danger" };
  }
  return {
    text: "text-muted-foreground",
    bg: "bg-secondary",
    dot: "bg-muted-foreground",
  };
}
