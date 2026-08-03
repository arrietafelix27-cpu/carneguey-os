// Crea el PRIMER usuario admin de una instancia de Miura por la API de
// administración oficial de Supabase (NO insertar a mano en auth.users por
// SQL: deja filas incompletas que rompen el login).
//
// Uso:  node scripts/seed-users.mjs
// Lee de .env.local:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   MIURA_ADMIN_EMAIL, MIURA_ADMIN_PASSWORD, MIURA_ADMIN_NAME
// Es idempotente: si el usuario ya existe, lo omite.
//
// Las demás cuentas (cajeras) se crean desde la app una vez dentro.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Cargar .env.local sin dependencias externas
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
  );
  process.exit(1);
}

const email = env.MIURA_ADMIN_EMAIL;
const password = env.MIURA_ADMIN_PASSWORD;
const fullName = env.MIURA_ADMIN_NAME || "Administrador";

if (!email || !password) {
  console.error(
    "Falta MIURA_ADMIN_EMAIL o MIURA_ADMIN_PASSWORD en .env.local.\n" +
      "Define el correo y la contraseña del primer administrador y vuelve a correr.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing, error: listErr } = await admin.auth.admin.listUsers();
if (listErr) {
  console.error("No se pudo listar usuarios:", listErr.message);
  process.exit(1);
}

if (existing.users.some((u) => u.email === email)) {
  console.log(`= ${email} ya existe, omitido`);
  process.exit(0);
}

const { error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, role: "admin" },
});

if (error) {
  console.error(`x ${email}: ${error.message}`);
  process.exit(1);
}

console.log(`+ ${email} creado (admin)`);
