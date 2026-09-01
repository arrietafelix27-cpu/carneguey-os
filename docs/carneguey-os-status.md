# Estado del proyecto — Miura

> Documento vivo. **Esta es la fuente de verdad del estado del proyecto.**
> Cada vez que se cierra una fase se actualiza este archivo.
>
> Última actualización: **2026-08-27**

**Producto:** Miura — sistema de gestión completo para carnicerías (POS + administración).
**Decisiones y deudas técnicas:** [`DECISIONS.md`](DECISIONS.md)
**Documento histórico:** [`carneguey-os-spec-v1.md`](carneguey-os-spec-v1.md) — describe la v1.0
original (módulo de inventario para una sola carnicería). Útil como referencia
del modelo de datos y los flujos de inventario; **no** como definición de alcance.

---

## Dónde estamos

La app está **funcionalmente completa en cobertura**: 52 pantallas, 37 migraciones,
~20.700 líneas. Cubre POS, compras (res en pie, canal directo, cerdo, pollo, otros),
desposte y sub-desposte, transferencias de cortes, inventario, conteo quincenal,
cuadre de caja, gastos y egresos, clientes con crédito, proveedores con cuentas por
pagar, nómina y analítica de merma.

**La etapa actual no es construir, es terminar**: pulir lo que existe, tapar los
huecos funcionales detectados en la auditoría del 2026-08-26, y dejarlo listo para
mostrárselo a carnicerías piloto.

### Fases cerradas y verificadas

| Fase | Qué entregó | Referencia |
|---|---|---|
| **1 · Multi-negocio** | Aislamiento por `organization_id` en las tablas de negocio, RLS + funciones `SECURITY DEFINER`. Migraciones 030→033 | D-016, D-017, D-018 |
| **2 · App unificada por rol** | Puerta única (`/`), un solo `AppNav`, protección de servidor en `/admin`. Las URLs `/admin` y `/empleado` se conservan a propósito | D-019 |
| **3 · Báscula universal** | Patrón de código de barras por organización, detección determinista, RPC `fn_set_scale_pattern` | D-020 |
| **Pulido · Compras y desposte** | Migración 037: bloquea merma negativa al finalizar, bloquea aprobar transferencias/sub-despostes sin stock, cancelar desposte con permisos | commits `a977878`, `d443e87` |

---

## Auditoría de punta a punta — 2026-08-26

Revisión completa de las 52 pantallas, las 21 áreas de acciones y las 37 migraciones.

### Lo que está sólido

- **30 de 30 tablas con RLS activada.** Sin excepciones.
- **El dinero nunca se calcula en el cliente**: costos, mermas y totales se resuelven
  en funciones `SECURITY DEFINER` dentro de la base.
- **Higiene de código**: cero `any`, cero `console.log`, cero TODOs pendientes,
  `tsc --noEmit` limpio.
- **Inmutabilidad respetada**: movimientos de inventario, despostes finalizados y
  conteos completados no se editan ni se borran — se corrigen con ajustes nuevos.
- **Sin marca quemada**: ningún nombre de negocio en componentes o pantallas.
  La identidad sale de `lib/config.ts`. Listo para otro cliente.

### Huecos detectados en la auditoría — estado

| # | Hueco | Estado |
|---|---|---|
| 1 | No se podía anular ni devolver una venta | ✅ migración 039 |
| 2 | El POS moría sin internet | ✅ migración 042 + cola local (opción B) |
| 3 | La analítica no hablaba de plata | ✅ `/admin/analitica/dinero` |
| 4 | El panel del dueño solo mostraba alertas | ✅ ahora abre con ventas y ganancia |
| 5 | No existía el tutorial de primera vez | ✅ `FirstRunTour` |
| 6 | No hay exportación a Excel/PDF | ⏳ pendiente |
| 7 | `listTeam()` pagina Auth a 1000 usuarios | ⏳ irrelevante hoy |

### Errores encontrados y corregidos (2026-08-26 / 27)

- **Umbrales de merma no guardaban** desde la migración 033: el upsert usaba
  `onConflict: "key"` y la PK había pasado a `(organization_id, key)`.
- **Fechas en hora de Londres.** Siete archivos usaban `toISOString()` para
  saber "hoy" — cinco horas adelante de Colombia. De 7 p.m. a medianoche eso
  fechaba las compras al día siguiente y la validación "no puede ser futura"
  dejaba pasar mañana. Todo pasa ahora por `lib/dates.ts`.
- **Conteo quincenal invisible**: el módulo no estaba en ningún menú; solo se
  llegaba si el dashboard lanzaba una alerta, o sea si Félix se atrasaba.
- **La cajera no podía trabajar desde el computador**: Compras, Procesos y
  Gastos existían solo en el menú del celular.
- **Doble devolución de inventario** (introducido en la 039): anular una venta
  con devolución previa devolvía todo otra vez. Corregido en la 041.
- **Cupo de crédito decorativo**: `credit_limit` se guardaba y mostraba pero no
  bloqueaba nada. Corregido en la 041 (ver D-025).
- **Contraseñas en un repositorio público** (DT-005).

## Hoja de ruta

### Construido

| Fase | Qué entregó |
|---|---|
| **0** | Documentación al día (README, este archivo, CLAUDE.md), D-021 y D-022 |
| **1a** | Acciones delicadas configurables por negocio (038) |
| **1b** | Anular y devolver ventas (039), con corrección en la 041 |
| **1c** | `/admin/actividad` — historial de todo lo que hace el equipo |
| **1d** | Cupo de crédito respetado (041) · cobro por WhatsApp · comprobantes con foto configurables (040) |
| **2** | POS sin internet, opción B (042) · app instalable (manifest) |
| **5** | Analítica de dinero · panel del dueño con ventas y ganancia |
| **6** | Tutorial de primera vez · menú del admin en 5 puertas |

### Pendiente

| # | Qué falta | Nota |
|---|---|---|
| **A** | **Pruebas de Félix** de todo lo anterior | Nada se ha probado en vivo |
| **B** | Avisos al celular cuando la cajera pide una aprobación | La base (app instalable) ya está |
| **C** | Exportar a Excel/PDF | Para el contador |
| **D** | Pulido a fondo de Finanzas y Nómina | Auditoría módulo por módulo |
| **E** | Diseño visual | Lo toma Félix |
| **F** | Onboarding de negocio nuevo | Hoy es manual, y está bien para los pilotos |

## Cómo se despliega un cliente nuevo

**Cada carnicería vive en su propia base de datos** (D-021). No hay auto-registro:
el despliegue lo hace Félix con acompañamiento, que es como se venderá en la etapa
piloto. El procedimiento repetible se formaliza en la Fase 6.

Pasos hoy: proyecto Supabase nuevo → correr las migraciones en orden → `supabase/seed.sql`
→ `node scripts/seed-users.mjs` con las variables `MIURA_ADMIN_*` → desplegar en Vercel
con `NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_OWNER_NAME` y `NEXT_PUBLIC_SITE_URL`.
