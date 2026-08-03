/**
 * Identidad configurable por instancia (una carnicería = un deploy de Miura).
 * Se define por variables de entorno; sin ellas usa valores genéricos.
 */

/** Marca del producto (fija). */
export const PRODUCT_NAME = "Miura";

/** Nombre del negocio del cliente. Aparece en los títulos de pestaña y el login. */
export const BUSINESS_NAME =
  process.env.NEXT_PUBLIC_BUSINESS_NAME?.trim() || "Mi Carnicería";

/** Nombre del dueño/administrador. Aparece en textos de aprobación. */
export const OWNER_NAME =
  process.env.NEXT_PUBLIC_OWNER_NAME?.trim() || "el administrador";
