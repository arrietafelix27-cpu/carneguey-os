# Miura

Sistema de gestión completo para carnicerías: el POS y la administración del
negocio en una sola aplicación — inventario, lotes, desposte y control de merma,
cuadre de caja, gastos, ventas a crédito, clientes, cuentas por pagar a
proveedores, nómina y analítica.

Estado del proyecto y hoja de ruta en
[`docs/carneguey-os-status.md`](docs/carneguey-os-status.md).

## Modelo de despliegue

**Una instancia por cliente** (ver `DECISIONS.md` D-021): cada carnicería tiene su
propio proyecto de Supabase y su propio despliegue en Vercel. No hay una instalación
compartida entre negocios — la separación de datos es estructural, no depende del
código de la aplicación.

## Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Estilos:** Tailwind CSS v4 + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Formularios:** react-hook-form + zod
- **Fechas:** date-fns (zona `America/Bogota`)
- **Iconos:** lucide-react
- **Deploy:** Vercel

## Cómo levantar una instancia

### Requisitos

- Node.js 18.18+ o 20+
- npm
- Un proyecto de Supabase **nuevo y vacío** para ese cliente

### Pasos

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Configurar variables de entorno: copiar `.env.local.example` a `.env.local` y
   rellenar los valores. Ver el archivo de ejemplo para la lista completa —
   incluye las credenciales de Supabase, la identidad del negocio
   (`NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_OWNER_NAME`, `NEXT_PUBLIC_SITE_URL`)
   y las credenciales del primer admin (`MIURA_ADMIN_*`).

   ```bash
   cp .env.local.example .env.local
   ```

   `SUPABASE_SERVICE_ROLE_KEY` es solo para el servidor — nunca se expone al cliente.

3. Aplicar la base de datos: en el SQL Editor de Supabase, ejecutar **todas** las
   migraciones de `supabase/migrations/` en orden numérico (001 → 037), y luego
   `supabase/seed.sql` (catálogo base de proveedores y productos).

4. Crear el usuario administrador (una sola vez):

   ```bash
   node scripts/seed-users.mjs
   ```

   Lee `MIURA_ADMIN_EMAIL`, `MIURA_ADMIN_PASSWORD` y `MIURA_ADMIN_NAME` de
   `.env.local`. Los usuarios NO se crean por SQL — ver `DECISIONS.md` D-012.
   El resto del equipo (cajeras) se crea después desde la app, en
   **Configuración → Equipo**.

5. Levantar el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   La app queda disponible en [http://localhost:3000](http://localhost:3000).

## Estructura

```
app/
  (admin)/            pantallas del dueño
  (employee)/         pantallas de la cajera (incluye el POS)
  (auth)/             login y recuperación de contraseña
components/
  admin/ employee/ shared/   componentes por audiencia
  ui/                 componentes shadcn/ui
lib/
  actions/            Server Actions (toda mutación pasa por aquí)
  supabase/           clientes de Supabase (browser, server, middleware, admin)
  validations/        esquemas zod
middleware.ts         autenticación y protección de rutas por rol
supabase/             migraciones SQL y seed
docs/                 estado, decisiones, spec histórica
```

## Documentación interna

- [`docs/carneguey-os-status.md`](docs/carneguey-os-status.md) — **estado real y hoja de ruta**. Empezar aquí.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisiones técnicas, deudas técnicas e ideas fuera de alcance.
- [`docs/carneguey-os-spec-v1.md`](docs/carneguey-os-spec-v1.md) — spec histórica de la v1.0 (un solo negocio). Referencia del modelo de datos, no de alcance.
- [`CLAUDE.md`](CLAUDE.md) — instrucciones para el agente de desarrollo.
