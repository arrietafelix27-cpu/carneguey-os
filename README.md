# Carnegüey OS

Sistema de gestión interno de **Carnegüey**, carnicería en Sincelejo (Sucre,
Colombia).

Versión actual: **v1.0** — Módulo de Inventario. Spec maestra en
[`docs/carneguey-os-spec-v1.md`](docs/carneguey-os-spec-v1.md). Estado del
proyecto en [`docs/carneguey-os-status.md`](docs/carneguey-os-status.md).

## Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Estilos:** Tailwind CSS v4 + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Formularios:** react-hook-form + zod
- **Fechas:** date-fns (zona `America/Bogota`)
- **Iconos:** lucide-react
- **Deploy:** Vercel

## Cómo correr en local

### Requisitos

- Node.js 18.18+ o 20+
- npm
- Un proyecto de Supabase con las credenciales a mano

### Pasos

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Configurar variables de entorno:

   Copiar `.env.local.example` a `.env.local` y rellenar los tres valores con
   los del dashboard de Supabase (Project Settings → API).

   ```bash
   cp .env.local.example .env.local
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key.
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key (solo servidor, nunca exponer al cliente).

3. Aplicar la base de datos (una sola vez): en el SQL Editor de Supabase,
   ejecutar `supabase/migrations/001_initial_schema.sql` y luego
   `supabase/seed.sql` (proveedores + productos).

4. Crear los usuarios iniciales (una sola vez):

   ```bash
   node scripts/seed-users.mjs
   ```

   Crea admin `felix@carneguey.com` (PIN 2723) y `cajera1`/`cajera2@carneguey.com`
   (`Carneguey2026!`). Los usuarios NO se crean por SQL — ver DECISIONS.md D-012.

5. Levantar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   La app queda disponible en [http://localhost:3000](http://localhost:3000).

## Estructura

```
app/                  rutas (App Router de Next.js)
components/
  ui/                 componentes shadcn/ui
lib/
  supabase/           clientes de Supabase (browser, server, middleware)
  utils.ts            utilidades (cn, formatters)
middleware.ts         middleware de Next.js (auth + roles, paso 3)
supabase/             migraciones SQL y seed (paso 2)
docs/                 spec, estado, decisiones
```

## Documentación interna

- [`docs/carneguey-os-spec-v1.md`](docs/carneguey-os-spec-v1.md) — especificación completa de la v1.0.
- [`docs/carneguey-os-status.md`](docs/carneguey-os-status.md) — bitácora de hitos y próximos pasos.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisiones técnicas, deudas técnicas e ideas fuera de alcance.
- [`CLAUDE.md`](CLAUDE.md) — instrucciones para el agente de desarrollo.
