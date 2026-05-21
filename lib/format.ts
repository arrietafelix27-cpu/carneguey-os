/** Cantidad en kg: 2 decimales, separador decimal coma. Ej: 3.600,50 */
export function formatKg(value: number): string {
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Cantidad genérica (kg o unidades) con hasta 2 decimales. */
export function formatQty(value: number): string {
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Pesos colombianos: $XX.XXX.XXX (separador de miles con punto). */
export function formatCOP(value: number): string {
  return "$" + Math.round(value).toLocaleString("es-CO");
}
