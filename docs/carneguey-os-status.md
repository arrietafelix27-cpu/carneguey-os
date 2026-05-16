# Estado del proyecto — Carnegüey OS

> Documento vivo. Cada vez que se cierra un hito se actualiza este archivo.

**Versión actual en construcción:** v1.0 — Módulo de Inventario
**Spec maestra:** [`carneguey-os-spec-v1.md`](carneguey-os-spec-v1.md)
**Decisiones y deudas técnicas:** [`DECISIONS.md`](DECISIONS.md)

---

## Bitácora de hitos

### Paso 1 · Bootstrap del proyecto — ✅ completado (2026-05-15)

Stack base inicializado en la raíz `/Users/felixarrieta/Desktop/carneguey/`.

**Lo que quedó hecho:**
- Next.js **15.5.18** (App Router, TypeScript, Tailwind v4, ESLint).
- Dependencias instaladas: `@supabase/supabase-js`, `@supabase/ssr`, `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`, `lucide-react`.
- shadcn/ui inicializado, estilo `base-nova`, iconos `lucide`. Componentes base: `button`, `input`, `form`, `card`, `dialog`, `dropdown-menu`, `select`, `label`, `textarea`, `sonner`, `skeleton`.
- Tokens de diseño Carnegüey aplicados en `app/globals.css` (paleta rojo de marca, SF Pro stack, radii 14/16/12, escala tipográfica iOS).
- Clientes Supabase creados en `lib/supabase/{client,server,middleware}.ts`.
- `middleware.ts` skeleton (passthrough, sin lógica de auth aún).
- `.env.local.example` y `.env.local` placeholder.
- Git inicializado por `create-next-app`.

**Verificado:** `npm run dev` levanta en http://localhost:3000 sin errores y muestra el placeholder "Carnegüey OS · v1.0 en construcción".

---

### Paso 2 · Migración inicial de Supabase — ✅ redactada (2026-05-15)

`supabase/migrations/001_initial_schema.sql` completa (bloques A–H) y
`supabase/seed.sql` listos para ejecutar en el SQL Editor de Supabase.

Contenido: 12 tablas, 17 índices, función `gen_lot_code` + trigger, 9 vistas
(3 calculadas + 5 empleado + 1 resultado-conteo admin), 30 RLS policies +
GRANTs, 10 funciones RPC SECURITY DEFINER de inventario, trigger
`auth.users → profiles`, bucket Storage `receipts` con policies. Seed: 3
usuarios (1 admin + 2 cajeras), 5 proveedores, ~55 productos.

Decisiones técnicas registradas: D-005 a D-011 en `DECISIONS.md`.

**Pendiente:** Félix ejecuta el SQL en su Supabase (instrucciones entregadas).

### Paso 3 · Autenticación + roles + middleware — ✅ completado (2026-05-16)

Login funcionando (verificado en navegador por Félix). Incidencia resuelta:
los usuarios sembrados por SQL rompían GoTrue; se recrearon por Admin API
(D-012). Admin: felix@carneguey.com / PIN 2723 (D-004). Cajeras:
cajera1/cajera2@carneguey.com / Carneguey2026!.

### Paso 4 · Gestión de proveedores y productos — ✅ redactado (2026-05-16)

Panel admin con navegación. Proveedores: lista simple (sin campo tipo,
D-013) con agregar/editar/activar. Productos: lista por categoría con
filtros, buscador y CRUD (nombre, categoría, unidad, origen, código POS).
Catálogo real cargado (9 proveedores, 81 productos). Build OK, RLS
verificada. **Pendiente:** que Félix lo pruebe en el navegador.

## Próximo paso

### Paso 5 · Lote de canal directo y cerdo — ⏳ siguiente

Primer flujo de compra para la cajera (el más simple, sección 15.3 #4).

---

## Backlog (sección 15.3 del spec)

1. ✅ Bootstrap del proyecto
2. ⏳ Migración inicial Supabase + seed
3. Auth + roles + middleware
4. Catálogo (proveedores/productos)
5. Lote canal directo y cerdo
6. Entrada directa (pollo/otros)
7. Lote en pie + llegada de canales
8. Desposte con contador en tiempo real
9. Inventario (admin y empleado)
10. Conteo físico
11. Comprobantes (Storage)
12. Refinamiento visual + PWA + deploy Vercel
