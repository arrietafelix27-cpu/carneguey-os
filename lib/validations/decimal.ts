import { z } from "zod";

/**
 * Envuelve un schema numérico para aceptar strings con coma o punto como
 * separador decimal (uso colombiano: "9,4" tanto como "9.4"). Sirve igual
 * para enteros — la validación interna decide.
 */
export function coerceDecimal<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (v) => {
      if (typeof v === "string") {
        const s = v.trim().replace(",", ".");
        if (s === "") return v;
        const n = Number(s);
        return Number.isNaN(n) ? v : n;
      }
      return v;
    },
    schema,
  );
}
