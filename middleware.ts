import { NextResponse, type NextRequest } from "next/server";

/**
 * Skeleton del middleware. En este paso 1 solo deja pasar todas las
 * peticiones — el refresco de sesión de Supabase y la protección de
 * rutas por rol se activan en paso 3 (auth + roles).
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
