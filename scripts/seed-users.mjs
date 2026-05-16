// Crea los usuarios iniciales de Carnegüey OS por la API de administración
// oficial de Supabase (NO insertar a mano en auth.users por SQL: deja filas
// incompletas que rompen el login — ver docs/DECISIONS.md D-012).
//
// Uso:  node scripts/seed-users.mjs
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de .env.local
// Es idempotente: si un usuario ya existe, lo omite.

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
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: "felix@carneguey.com",
    password: "2723",
    user_metadata: { full_name: "Félix Arrieta", role: "admin" },
  },
  {
    email: "cajera1@carneguey.com",
    password: "Carneguey2026!",
    user_metadata: { full_name: "Cajera 1", role: "employee" },
  },
  {
    email: "cajera2@carneguey.com",
    password: "Carneguey2026!",
    user_metadata: { full_name: "Cajera 2", role: "employee" },
  },
];

const { data: existing, error: listErr } = await admin.auth.admin.listUsers();
if (listErr) {
  console.error("No se pudo listar usuarios:", listErr.message);
  process.exit(1);
}
const existingEmails = new Set(existing.users.map((u) => u.email));

for (const u of USERS) {
  if (existingEmails.has(u.email)) {
    console.log(`= ${u.email} ya existe, omitido`);
    continue;
  }
  const { error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: u.user_metadata,
  });
  if (error) {
    console.error(`x ${u.email}: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`+ ${u.email} creado (${u.user_metadata.role})`);
  }
}
