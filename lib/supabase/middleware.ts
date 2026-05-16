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

  // Sin sesión: solo puede ver /login.
  if (!user) {
    return onLogin
      ? supabaseResponse
      : redirectWithCookies(request, supabaseResponse, LOGIN_PATH);
  }

  // Con sesión: leer rol.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    return redirectWithCookies(request, supabaseResponse, LOGIN_PATH);
  }

  const home = profile.role === "admin" ? "/admin" : "/empleado";

  // Usuario logueado en /login o en la raíz -> a su home.
  if (onLogin || path === "/") {
    return redirectWithCookies(request, supabaseResponse, home);
  }

  // Protección de rutas: /admin solo admin (spec §5.3 / §7.2).
  // /empleado es accesible para ambos roles.
  if (path.startsWith("/admin") && profile.role !== "admin") {
    return redirectWithCookies(request, supabaseResponse, "/empleado");
  }

  return supabaseResponse;
}
