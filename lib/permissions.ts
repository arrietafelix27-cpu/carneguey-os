/**
 * Políticas del negocio que el dueño configura desde la app:
 *
 *  · Acciones delicadas (038): cuáles puede hacer la cajera sola y cuáles
 *    quedan pendientes de su aprobación.
 *  · Comprobantes con foto (040): de qué flujos se exige foto del soporte.
 *
 * Este archivo es solo tipos y constantes — lo importan tanto el servidor como
 * las pantallas. La lectura contra la base vive en `lib/permissions.server.ts`.
 *
 * La fuente de verdad es la base de datos: el bloqueo real está en las
 * funciones `fn_*` y en las Server Actions, así que aunque alguien manipule la
 * pantalla no se salta la regla.
 */

export const PERMISSION_KEYS = [
  "perm_cut_transfer",
  "perm_sub_desposte",
  "perm_cash_outflow",
  "perm_void_sale",
  "perm_return_sale",
] as const;

export const RECEIPT_KEYS = [
  "receipt_carcass_lot",
  "receipt_expense",
  "receipt_lot_arrival",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type ReceiptKey = (typeof RECEIPT_KEYS)[number];
export type PolicyKey = PermissionKey | ReceiptKey;

export const POLICY_KEYS: readonly PolicyKey[] = [
  ...PERMISSION_KEYS,
  ...RECEIPT_KEYS,
];

/**
 * Permisos: true = la cajera puede sola · false = necesita aprobación.
 * Comprobantes: true = exige foto · false = la foto es opcional.
 */
export type Policies = Record<PolicyKey, boolean>;

/** Estricto por defecto: si algo falta o falla, se pide aprobación y se exige foto. */
export const STRICT_POLICIES: Policies = {
  perm_cut_transfer: false,
  perm_sub_desposte: false,
  perm_cash_outflow: false,
  perm_void_sale: false,
  perm_return_sale: false,
  receipt_carcass_lot: true,
  receipt_expense: true,
  receipt_lot_arrival: true,
};

/** Compatibilidad con el nombre anterior. */
export type Permissions = Policies;
export const STRICT_PERMISSIONS = STRICT_POLICIES;

/**
 * Cómo se le explica cada acción delicada al dueño. El orden es el de la
 * pantalla: primero lo que mueve plata.
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
  },
  {
    key: "perm_return_sale",
    label: "Hacer una devolución",
    description:
      "El cliente trae el producto de vuelta: sale plata de la caja y el producto regresa al inventario.",
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

/** De qué flujos se puede exigir foto del comprobante. */
export const RECEIPT_INFO: {
  key: ReceiptKey;
  label: string;
  description: string;
}[] = [
  {
    key: "receipt_carcass_lot",
    label: "Compra de canal (res y cerdo)",
    description:
      "Foto de la factura o el recibo del proveedor al registrar la compra.",
  },
  {
    key: "receipt_expense",
    label: "Gastos y salidas de efectivo",
    description: "Foto del soporte de cada gasto que registra la cajera.",
  },
  {
    key: "receipt_lot_arrival",
    label: "Llegada de canales",
    description:
      "Foto al recibir las canales del ganado que compraste en pie.",
  },
];

/** Normaliza lo que devuelve `fn_get_permissions` a un objeto completo. */
export function normalizePolicies(raw: unknown): Policies {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const out = { ...STRICT_POLICIES };
  for (const key of POLICY_KEYS) {
    if (typeof obj[key] === "boolean") out[key] = obj[key] as boolean;
  }
  return out;
}

/** Compatibilidad con el nombre anterior. */
export const normalizePermissions = normalizePolicies;
