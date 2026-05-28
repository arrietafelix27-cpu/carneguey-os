import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/login";

function redirectWithCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const res = NextResponse.redirect(url);
  from.cookies.getAll().forEach((c) => res.cookies.set(c));
  return res;
}

/**
 * Middleware ligero: solo refresca la sesión y bloquea rutas sin auth.
 * La verificación de rol (admin vs employee) y las redirecciones por rol
 * las hace cada layout (admin/empleado) con `getCurrentProfile()`. Eso
 * evita una consulta duplicada a `profiles` en cada navegación.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const onLogin = path === LOGIN_PATH;

  // Sin sesión: solo /login.
  if (!user) {
    return onLogin
      ? supabaseResponse
      : redirectWithCookies(request, supabaseResponse, LOGIN_PATH);
  }

  // Con sesión en /login o en la raíz → mandar a "/" para que el server
  // component de raíz haga la redirección por rol (única fuente de verdad).
  if (onLogin || path === "/") {
    return path === "/"
      ? supabaseResponse
      : redirectWithCookies(request, supabaseResponse, "/");
  }

  return supabaseResponse;
}
