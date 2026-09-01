"use client";

/**
 * Cola de ventas pendientes por falta de señal (D-022, opción B).
 *
 * Cuando el POS ya está abierto y se cae el internet, la venta no se pierde:
 * se guarda en el computador y se reintenta sola cuando vuelve la conexión.
 *
 * Reintentar es seguro porque cada venta lleva un `client_ref` único generado
 * ANTES del primer intento (migración 042): si la venta alcanzó a entrar y lo
 * que se cayó fue la respuesta, el reintento devuelve la misma venta en vez de
 * duplicarla.
 *
 * Se usa localStorage a propósito: sobrevive a recargar la página y a cerrar
 * el navegador, y el volumen es mínimo (unas pocas ventas mientras vuelve la
 * señal). No se usa para nada más — la verdad sigue estando en la base.
 */

const KEY = "miura.pos.pending-sales.v1";

export type PendingSale = {
  clientRef: string;
  payload: unknown;
  /** Texto para mostrarle a la cajera qué venta es. */
  label: string;
  savedAt: number;
  attempts: number;
};

export function newClientRef(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function readQueue(): PendingSale[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingSale[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(list: PendingSale[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Sin espacio o almacenamiento bloqueado: no hay nada que hacer aquí.
    // La cajera ya vio el aviso de que la venta quedó pendiente.
  }
}

export function enqueue(sale: PendingSale): void {
  const list = readQueue();
  if (list.some((s) => s.clientRef === sale.clientRef)) return;
  list.push(sale);
  writeQueue(list);
}

export function dequeue(clientRef: string): void {
  writeQueue(readQueue().filter((s) => s.clientRef !== clientRef));
}

export function bumpAttempts(clientRef: string): void {
  writeQueue(
    readQueue().map((s) =>
      s.clientRef === clientRef ? { ...s, attempts: s.attempts + 1 } : s,
    ),
  );
}

/**
 * Distingue "se cayó la red" de "el servidor rechazó la venta".
 *
 * Es la diferencia que importa: un fallo de red se reintenta; un rechazo del
 * servidor (cliente sin cupo, producto inválido) NO se debe reintentar — hay
 * que mostrárselo a la cajera.
 */
export function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (err instanceof TypeError) return true; // fetch abortado / sin red
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err);
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("failed to load") ||
    msg.includes("load failed") ||
    msg.includes("timeout")
  );
}
