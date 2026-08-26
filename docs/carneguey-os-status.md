# Estado del proyecto — Miura

> Documento vivo. **Esta es la fuente de verdad del estado del proyecto.**
> Cada vez que se cierra una fase se actualiza este archivo.
>
> Última actualización: **2026-08-26**

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

### Huecos detectados (ordenados por impacto de negocio)

1. **No se puede anular ni devolver una venta.** `lib/actions/sales.ts` solo expone
   `completeSale`. **La base ya está preparada**: `sales.status` acepta `returned` y
   `cancelled`, y el cuadre, los saldos de clientes y las ventas del día ya excluyen
   las anuladas — pero ninguna ruta de código las pone en ese estado. La tubería está,
   falta la llave. → **Fase 1**
2. **El POS muere sin internet.** La app se renderiza en el servidor: sin señal, la
   pantalla del POS ni siquiera abre. Sin PWA, sin manejo de conexión. → **Fase 2**
3. **La analítica no habla de plata.** Solo mide merma y rendimiento. No hay ventas
   del mes, margen, producto más rentable ni comparativo contra el período anterior.
   Los datos existen; la pantalla no. Choca con la filosofía de producto
   ("control total, no se escapa ningún dato"). → **Fase 5**
4. **El panel del dueño solo muestra alertas.** Si no hay nada urgente queda vacío.
   Es un panel de problemas, no de estado del negocio. → **Fase 5**
5. **No existe el tutorial de primera vez.** Está en la visión de producto, no en el
   código. → **Fase 6**
6. **No hay exportación de datos** (Excel/PDF) para el contador o el dueño. → **Fase 5**
7. **Menor:** `listTeam()` (`lib/actions/team.ts`) pagina Auth a 1000 usuarios totales
   antes de filtrar por organización. Irrelevante hoy; anotar si Miura crece.

---

## Hoja de ruta

| # | Fase | Qué se pone | Qué se modifica |
|---|---|---|---|
| **0** | Orden de casa | — | Documentación al día (README, este archivo, CLAUDE.md); registrar D-021 y D-022 |
| **1** | Ventas y clientes | Anular venta y devolver venta; cobro por WhatsApp a clientes con saldo | Pulido de POS y clientes; verificar cadena venta a crédito → abono → saldo |
| **2** | POS a prueba de fallas | Venta offline **opción B** (D-022): si el POS ya está abierto y cae la conexión, sigue vendiendo y sincroniza al volver; indicador de estado de conexión | La pantalla del POS pasa a guardar catálogo y precios en el dispositivo |
| **3** | Finanzas | Recordatorio de cuentas por pagar próximas a vencer | Pulido de cuadre de caja, egresos y cuentas por pagar de punta a punta |
| **4** | Nómina y equipo | Por definir tras auditoría del módulo | Pulido de pago de nómina, deducciones y gestión de empleados |
| **5** | Analítica y panel del dueño | Analítica de dinero (ventas, margen, producto más rentable, comparativo); exportación a Excel/PDF | El panel de inicio pasa de "solo alertas" a "cómo va mi negocio hoy" + alertas debajo |
| **6** | Primera impresión | Tutorial de primera vez; procedimiento repetible para instalar un cliente nuevo | Simplificar el menú del admin (hoy 7 grupos — demasiada puerta a la vez) |

**Orden acordado con Félix (2026-08-26):** la Fase 2 va **antes** de Finanzas — un POS
que se cae le duele más al cliente que una pantalla de finanzas incompleta.

### Decisiones de negocio pendientes

- **Fase 1 — anular/devolver:** ¿la cajera puede anular sola o requiere aprobación del
  admin? ¿Se puede devolver solo parte de una venta o toda completa? ¿Hasta cuándo se
  puede anular (mismo día, día ya cerrado)?
- **Fase 4:** alcance real del pulido de nómina, tras auditar el módulo.

---

## Cómo se despliega un cliente nuevo

**Cada carnicería vive en su propia base de datos** (D-021). No hay auto-registro:
el despliegue lo hace Félix con acompañamiento, que es como se venderá en la etapa
piloto. El procedimiento repetible se formaliza en la Fase 6.

Pasos hoy: proyecto Supabase nuevo → correr las migraciones en orden → `supabase/seed.sql`
→ `node scripts/seed-users.mjs` con las variables `MIURA_ADMIN_*` → desplegar en Vercel
con `NEXT_PUBLIC_BUSINESS_NAME`, `NEXT_PUBLIC_OWNER_NAME` y `NEXT_PUBLIC_SITE_URL`.
