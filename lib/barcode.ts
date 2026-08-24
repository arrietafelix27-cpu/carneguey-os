/**
 * Parseo y detección del código de barras de báscula (variable-peso), por
 * organización. Ver DECISIONS.md D-020 para el algoritmo de detección y cómo
 * se resuelven ambigüedades.
 *
 * Un EAN-13 de báscula codifica dos cosas en el mismo código: el código del
 * producto y su peso. El patrón dice en qué posiciones vienen (índice base 0)
 * y con qué divisor el entero del peso se vuelve kg (kg = entero / divisor).
 */

export type ScalePattern = {
  codeStart: number;
  codeLen: number;
  weightStart: number;
  weightLen: number;
  weightDivisor: number;
};

/** Solo dígitos. */
export function digitsOnly(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * Separa código de producto y peso de un código escaneado usando el patrón de
 * la organización. Devuelve null si el código es demasiado corto para el
 * patrón (lectura incompleta o código que no es de báscula).
 */
export function parseBarcode(
  raw: string,
  p: ScalePattern,
): { posCode: string; weightKg: number } | null {
  const d = digitsOnly(raw);
  if (d.length < p.weightStart + p.weightLen) return null;
  if (d.length < p.codeStart + p.codeLen) return null;

  const posCode = String(
    parseInt(d.slice(p.codeStart, p.codeStart + p.codeLen) || "0", 10),
  );
  const weightRaw = parseInt(
    d.slice(p.weightStart, p.weightStart + p.weightLen) || "0",
    10,
  );
  const weightKg = Math.round((weightRaw / p.weightDivisor) * 1000) / 1000;
  return { posCode, weightKg };
}

/** Divisores candidatos: diezmilésimas de kg (DIBAL) y gramos. */
const DIVISOR_CANDIDATES = [10000, 1000] as const;
const WEIGHT_LEN_MIN = 4;
const WEIGHT_LEN_MAX = 6;
const CODE_LEN_MAX = 7;

export type DetectResult =
  | { ok: true; pattern: ScalePattern }
  | { ok: false; reason: string };

/**
 * Deduce el patrón a partir de UN escaneo, sabiendo el código del producto
 * (el PLU que el dueño programó en su báscula) y el peso real confirmado.
 *
 * Conocer ambos valores hace la detección determinista: se busca en qué
 * posiciones aparece cada uno. Desempate (ver D-020): el campo de PESO se
 * prefiere el que termina más a la derecha y es más largo (las básculas ponen
 * el peso al final); el CÓDIGO, el más ancho empezando más a la izquierda
 * (prefijo mínimo). Si no hay ninguna combinación coherente → error claro.
 */
export function detectPattern(
  raw: string,
  posCode: string,
  weightKg: number,
): DetectResult {
  const d = digitsOnly(raw);
  if (d.length < 8) {
    return { ok: false, reason: "El código escaneado es muy corto." };
  }
  const codeNum = parseInt(digitsOnly(String(posCode)) || "-1", 10);
  if (!Number.isFinite(codeNum) || codeNum < 0) {
    return { ok: false, reason: "El código del producto no es válido." };
  }
  if (!(weightKg > 0)) {
    return { ok: false, reason: "El peso debe ser mayor a 0." };
  }

  // Campos candidatos de PESO: (start, len, divisor) cuyo entero == round(peso*div).
  type WField = { start: number; len: number; div: number };
  const wFields: WField[] = [];
  for (const div of DIVISOR_CANDIDATES) {
    const target = Math.round(weightKg * div);
    // Solo si el peso encaja "exacto" en ese divisor (evita falsos con redondeo).
    if (Math.abs(weightKg * div - target) > 0.5) continue;
    for (let len = WEIGHT_LEN_MIN; len <= WEIGHT_LEN_MAX; len++) {
      for (let start = 0; start + len <= d.length; start++) {
        if (parseInt(d.slice(start, start + len), 10) === target) {
          wFields.push({ start, len, div });
        }
      }
    }
  }

  // Campos candidatos de CÓDIGO: (start, len) cuyo entero == codeNum.
  type CField = { start: number; len: number };
  const cFields: CField[] = [];
  const codeDigits = String(codeNum).length;
  for (let len = Math.max(codeDigits, 1); len <= CODE_LEN_MAX; len++) {
    for (let start = 0; start + len <= d.length; start++) {
      if (parseInt(d.slice(start, start + len), 10) === codeNum) {
        cFields.push({ start, len });
      }
    }
  }

  // Combinaciones válidas: no se solapan y el código va antes del peso.
  const combos: { c: CField; w: WField }[] = [];
  for (const c of cFields) {
    for (const w of wFields) {
      const cEnd = c.start + c.len;
      const wEnd = w.start + w.len;
      const overlap = c.start < wEnd && w.start < cEnd;
      if (!overlap && c.start < w.start) combos.push({ c, w });
    }
  }
  if (combos.length === 0) {
    return {
      ok: false,
      reason:
        "El código escaneado no coincide con el peso y el código del producto.",
    };
  }

  // Desempate documentado (D-020):
  //  1) peso que termina más a la derecha
  //  2) peso más largo
  //  3) código empezando más a la izquierda (prefijo mínimo)
  //  4) código más ancho
  combos.sort(
    (a, b) =>
      b.w.start + b.w.len - (a.w.start + a.w.len) ||
      b.w.len - a.w.len ||
      a.c.start - b.c.start ||
      b.c.len - a.c.len,
  );

  const best = combos[0];
  return {
    ok: true,
    pattern: {
      codeStart: best.c.start,
      codeLen: best.c.len,
      weightStart: best.w.start,
      weightLen: best.w.len,
      weightDivisor: best.w.div,
    },
  };
}
