/**
 * Acciones delicadas: el dueño decide cuáles puede hacer la cajera sola y
 * cuáles quedan pendientes de su aprobación (migración 038).
 *
 * Este archivo es solo tipos y constantes — lo importan tanto el servidor como
 * las pantallas. La lectura contra la base vive en `lib/permissions.server.ts`.
 *
 * La fuente de verdad es la base de datos: el bloqueo real está en las
 * funciones `fn_*`, así que aunque alguien manipule la pantalla no se salta
 * el permiso.
 */

export const PERMISSION_KEYS = [
  "perm_cut_transfer",
  "perm_sub_desposte",
  "perm_cash_outflow",
  "perm_void_sale",
  "perm_return_sale",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** true = la cajera puede sola · false = necesita aprobación del admin. */
export type Permissions = Record<PermissionKey, boolean>;

/** Estricto por defecto: si algo falta o falla, se pide aprobación. */
export const STRICT_PERMISSIONS: Permissions = {
  perm_cut_transfer: false,
  perm_sub_desposte: false,
  perm_cash_outflow: false,
  perm_void_sale: false,
  perm_return_sale: false,
};

/**
 * Cómo se le explica cada acción al dueño. El orden es el de la pantalla:
 * primero lo que mueve plata.
 */
export const PERMISSION_INFO: {
  key: PermissionKey;
  label: string;
  description: string;
  pending?: boolean;
}[] = [
  {
    key: "perm_void_sale",
    label: "Anular una venta",
    description:
      "Borrar una venta que no debió existir. Cambia el cuadre de caja del día.",
    pending: true,
  },
  {
    key: "perm_return_sale",
    label: "Hacer una devolución",
    description:
      "El cliente trae el producto de vuelta: sale plata de la caja y el producto regresa al inventario.",
    pending: true,
  },
  {
    key: "perm_cash_outflow",
    label: "Sacar efectivo de la caja",
    description:
      "Salidas de fondo y adelantos a empleados. Las demás salidas (pagos a proveedor, gastos) nunca piden aprobación.",
  },
  {
    key: "perm_cut_transfer",
    label: "Transferir cortes",
    description:
      "Pasar peso de un corte a otro cuando se clasificó distinto. No mueve plata.",
  },
  {
    key: "perm_sub_desposte",
    label: "Hacer un sub-desposte",
    description:
      "Partir un corte ya en inventario en varios productos. No mueve plata.",
  },
];

/** Normaliza lo que devuelve `fn_get_permissions` a un objeto completo. */
export function normalizePermissions(raw: unknown): Permissions {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const out = { ...STRICT_PERMISSIONS };
  for (const key of PERMISSION_KEYS) {
    if (typeof obj[key] === "boolean") out[key] = obj[key] as boolean;
  }
  return out;
}
