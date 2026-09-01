import type { MetadataRoute } from "next";
import { BUSINESS_NAME, PRODUCT_NAME } from "@/lib/config";

/**
 * Hace que Miura se pueda instalar como app en el celular y en el computador
 * del negocio, en vez de vivir como una pestaña del navegador.
 *
 * Es la base de dos cosas del plan: que el POS aguante la caída de internet
 * (D-022) y, más adelante, los avisos al celular del dueño cuando la cajera
 * pide una aprobación.
 *
 * El nombre lo pone cada negocio por configuración — nada de marca quemada.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BUSINESS_NAME} · ${PRODUCT_NAME}`,
    short_name: BUSINESS_NAME,
    description: `Sistema de gestión de ${BUSINESS_NAME}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#FFFFFF",
    theme_color: "#D40000",
    lang: "es-CO",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
