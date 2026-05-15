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

## Próximo paso

### Paso 2 · Migración inicial de Supabase — ⏳ pendiente de aprobación

Crear `supabase/migrations/001_initial_schema.sql` con todo el modelo de datos de la sección 6 del spec: tablas, CHECK constraints, RLS policies, vistas restringidas para `employee`, funciones `SECURITY DEFINER` para inserción en `inventory_movements`, secuencias y función de `lot_code`, y seed (`supabase/seed.sql`) con usuarios, proveedores y productos de la sección 12.

Félix debe revisar este paso con calma antes de ejecutarlo, porque define la base de toda la app.

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
