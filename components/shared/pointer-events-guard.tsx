"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Tras cada navegación libera cualquier bloqueo de `pointer-events` que un
 * diálogo modal pueda haber dejado pegado en el <body>. Es la causa de que
 * a veces los botones (incluido "Panel") dejen de responder al cambiar de
 * pantalla con un diálogo abierto.
 */
export function PointerEventsGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const id = setTimeout(() => {
      if (document.body.style.pointerEvents === "none") {
        document.body.style.pointerEvents = "";
      }
    }, 0);
    return () => clearTimeout(id);
  }, [pathname]);

  return null;
}
