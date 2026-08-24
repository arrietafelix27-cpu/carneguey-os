# Decisiones del proyecto · Carnegüey OS

Registro de decisiones técnicas, dudas pendientes y deudas técnicas para
discusión. Las ideas que surgen fuera del alcance de v1.0 (sección 3.2
del spec) se anotan aquí en lugar de implementarlas.

---

## Decisiones tomadas

### D-020 · Fase 3 — báscula universal (patrón de código por organización)
**Fecha:** 2026-08-14
**Decisión:** El patrón del código de barras de la báscula se guarda por
organización, como 5 columnas nullable en `organizations`: `barcode_code_start`,
`barcode_code_len`, `barcode_weight_start`, `barcode_weight_len` (posiciones
base 0 dentro del EAN-13) y `barcode_weight_divisor` (kg = entero_peso /
divisor). Null = negocio sin báscula configurada. Se guarda vía RPC acotado
`fn_set_scale_pattern` (definer, solo-admin) para no abrir un UPDATE general
sobre `organizations`. Carnegüey migra su patrón fijo actual `(1,6,7,6,10000)`.
**Detección (lib/barcode.ts `detectPattern`):** se conoce el código del
producto (el PLU que el dueño escribe, igual al de su báscula) + el peso
confirmado + el escaneo. Con ambos valores conocidos la deducción es
determinista: se buscan las posiciones donde aparece cada uno. **Ambigüedad:**
si hay varias combinaciones posibles, el desempate es (1) campo de peso que
termina más a la derecha, (2) más largo, (3) código empezando más a la
izquierda —prefijo mínimo—, (4) más ancho. Si ninguna combinación cuadra
(código+peso no aparecen coherentes), se rechaza con mensaje claro; nunca
adivina. Divisores candidatos: 10000 (diezmilésimas, DIBAL) y 1000 (gramos).
**Fuera de alcance explícito:** básculas que codifican **precio** en vez de
peso en esa parte del código (existen, DIBAL no). No se soporta en v1; si un
cliente la usa, se retoma como fase aparte.
**Casos límite cubiertos:** código escaneado que no cuadra con el patrón →
rechazo con mensaje; producto sin código → entrada manual en el POS (ya existía);
peso ≤ 0 → la venta ya no se registra (validación previa del POS).
**DT-002 — resuelto:** los `pos_code` de Carnegüey se recargaron con datos
reales en la migración 015; no quedan productos con `pos_code` vacío que
requieran re-escaneo. DT-002 se da por cerrado.

### D-019 · Fase 2 — una sola experiencia por rol, conservando las URLs
**Fecha:** 2026-08-14
**Decisión:** No se colapsan los árboles `app/(admin)/admin/...` y
`app/(employee)/empleado/...` en una sola raíz de URLs. Se conservan tal cual
(no mover ~50 rutas, no romper enlaces guardados/compartidos como el detalle
de una venta) y la unificación se logra por rol, no por URL:
- **Puerta única:** `/` (`app/page.tsx`) redirige según `profiles.role` a
  `/admin` o `/empleado`. El middleware manda a `/` a quien llega autenticado
  a `/login` o `/`.
- **Menú único:** un solo `AppNav` (sidebar PC + barra móvil) que arma el menú
  desde el rol del que mira. No hay navs duplicados entre admin y empleado.
- **Protección real (servidor):** el layout de `/admin` hace
  `if role !== 'admin' redirect('/empleado')` — una cajera que escriba una URL
  `/admin/*` rebota antes de renderizar. El árbol `/empleado` queda abierto a
  ambos roles a propósito: el admin "ve todo" (incluido el POS). Defensa en
  profundidad: aunque una cajera llegara a una pantalla de admin, la RLS de
  Fase 1 (solo-admin + org) no le devuelve datos.
- **POS:** el POS vive en `/empleado/pos` (herramienta principal de la cajera,
  prominente en su menú). Para el admin se agrega en el submenú
  **Configuración** (accesible pero no prominente en su inicio).
**Por qué:** el objetivo del brief (el rol manda, no la URL) ya se cumplía en
gran parte por trabajo previo (nav unificada + redirect de rol + puerta única);
colapsar las URLs sería mucho movimiento de archivos y ruptura de enlaces por
un beneficio menor. Se privilegia bajo riesgo y cero cambio de datos.
**Pendiente futuro:** si en Fase 7 (pulido) se rediseña la navegación, se puede
reconsiderar unificar las URLs con redirects 301 de las viejas.

### D-016 · Multi-tenancy Fase 1 — aislamiento por organización
**Fecha:** 2026-08-10
**Decisión:** Se agrega `organizations` + `organization_id` a las 29 tablas de
negocio, con aislamiento por RLS y funciones `SECURITY DEFINER` que resuelven
el org con `current_org_id()` (nunca desde parámetro del cliente). Migraciones
en 4 pasos para no dejar la BD en estado roto: **030** (columna nullable +
backfill a la org semilla "Carnegüey (datos de prueba)" + `current_org_id()` +
`handle_new_user`), **031** (las 59 policies con filtro por org), **032** (las
funciones `fn_*` + `gen_lot_code`/`set_lot_code` org-aware), **033** (NOT NULL +
PK compuestas de `app_settings` y `lot_code_counters` + Storage). Correr 030→033
en orden, de una sentada.
**Nombres corregidos del brief:** `pos_sales`→`sales`, `pos_sale_items`→
`sale_items`, `customer_payments`→`credit_payments`, `supplier_accounts`→
`supplier_invoices`, `payroll_*`→`payroll_payments`/`payroll_deductions`.

### D-017 · `lib/cache.ts` — se elimina el caché global service-role (Opción B)
**Fecha:** 2026-08-10
**Decisión:** El caché de catálogo (`unstable_cache` + `service_role`) no
distingue negocio y sería el hueco más fácil de filtrar entre organizaciones.
Se elimina y se consulta directo con el cliente del usuario (RLS filtra por
org). El volumen por carnicería es pequeño, así que el costo de rendimiento es
despreciable frente al riesgo de fuga entre negocios.

### D-018 · Proveedores no se comparten entre organizaciones
**Fecha:** 2026-08-10
**Decisión:** Si dos negocios le compran al mismo proveedor real, cada uno
tiene su propia fila de proveedor (aunque el nombre se repita). No hay
proveedores compartidos entre organizaciones en Fase 1. Replantear si algún
día se necesita un catálogo de proveedores global.

### D-015 · Rediseño visual 2026 (App Store / Uber) — desviaciones por la regla "solo estética"
**Fecha:** 2026-06-12
**Decisión:** Rediseño visual completo dirigido por Félix (referencias App Store + Uber, solo modo claro). Se reemplazaron los tokens de `globals.css` (paleta, radios más redondeados, sombras `--shadow-sm/md/brand`, escala tipográfica) y se reestilizaron los componentes base (`button`, `input`, `textarea`, `label`, `card`, `select`, `dialog`, `sonner`, `skeleton`) más todas las pantallas. La regla del encargo fue **cero cambios de lógica, rutas, queries, acciones o posiciones**.
**Desviaciones del brief que NO se implementaron para no romper esa regla:**
1. **Home de cajera — grid 2×2 de 4 acciones:** el brief pedía 4 botones de acción en cuadrícula, pero la pantalla actual solo tiene **una** acción real (Compras) más una nota de "próximamente". Agregar acciones sería tocar estructura/funcionalidad. Se reestilizó la única tarjeta existente; cuando se habiliten Desposte/Inventario para cajera se podrá montar el grid.
2. **Toasts:** el brief pedía fondo oscuro uniforme con ícono de color; se quitó la prop `richColors` del `Toaster` (cosmético) y se fijó fondo `#1C1C1E` con íconos verde/rojo. No se tocó la posición (sigue `top-center`).
3. **Modales tipo "sheet desde abajo":** se mantuvieron centrados (con una animación sutil de entrada desde abajo) en vez de convertirlos en bottom-sheets, porque reanclar la posición del `Dialog` de base-ui es un cambio de comportamiento, no solo de estilo.
**Nota:** `globals.css` está en la lista de archivos protegidos del CLAUDE.md; se editó con autorización explícita de Félix en este encargo.

### D-014 · Conteo quincenal reusa physical_counts con semántica de ventas
**Fecha:** 2026-05-20
**Decisión:** El módulo de conteo quincenal (alcance redefinido, [[project_carneguey_os_v1]]) reusa las tablas `physical_counts` / `physical_count_items` en vez de tablas nuevas. Semántica: `theoretical_quantity` = stock teórico al iniciar; `physical_quantity` = cantidad VENDIDA en el período (la digita Félix); el "esperado" = `theoretical_quantity − physical_quantity` se calcula, no se almacena. Migración `003_sales_count.sql`: `fn_start_sales_count` (snapshot de productos con stock > 0) y `fn_complete_sales_count` (crea movimientos `adjustment_out` por las ventas y cierra el conteo).
**Razón:** Velocidad — evita crear tablas nuevas + RLS. El flujo del spec original (`physical_counts`: la cajera cuenta a ciegas) fue descartado en la redefinición de alcance del 2026-05-20; el conteo ahora es admin-driven (Félix ingresa ventas). Las funciones `fn_start_physical_count` / `fn_complete_physical_count` del 001 quedan sin uso pero no estorban.
**Trade-off:** `physical_quantity` significa "vendido" aquí, lo cual es semánticamente turbio respecto al nombre de la columna. Documentado para que no confunda. Si el modelo crece, considerar tablas dedicadas `sales_counts`.

### D-001 · Next.js pinned a v15 en v1.0
**Fecha:** 2026-05-15
**Decisión:** Usar `next@15` (instalado: 15.5.18) en lugar de `next@latest` (16.x).
**Razón:** Estabilidad y coincidencia con la spec. Next.js 16 acaba de salir y trae breaking changes en caching, RSC y APIs internas. El ecosistema (shadcn, librerías) tarda 2-3 meses en estabilizarse en majors nuevos. Esta es una app real de negocio, no un experimento.
**Revisión:** Evaluar migración a v16 después de tener v1.0 estable en producción.

### D-002 · Conflictos spec vs Taste Skill — la spec gana
**Fecha:** 2026-05-15
**Decisión:** Cuando una regla de la design-taste-frontend skill choque con la spec maestra, la spec gana. Aplica especialmente a:
- Tipografía: SF Pro / `-apple-system` stack (spec §10.3), NO Geist/Outfit/Satoshi.
- Iconos: `lucide-react` (spec §10.7), NO Phosphor ni Radix Icons.
- Color primario: `#D40000` saturación 100% (rojo de marca Carnegüey, spec §10.2), NO desaturar pese a la regla de la skill.
- Layout densidad: tabla densa estilo iOS Settings con `divide-y` para listados de inventario/lotes/movimientos. Bento asimétrico solo en home/dashboard del admin.

**Razón:** La spec refleja la identidad de un negocio físico real de 10 años. Las reglas anti-AI-slop genéricas se respetan donde no haya conflicto (mobile-first, layout transitions, skeleton loaders, empty states, tactile feedback, `min-h-[100dvh]`, etc.).

### D-003 · Cálculo del costo unitario al despostar — server-side
**Fecha:** 2026-05-15
**Decisión:** El cálculo de `unit_cost = total_cost_lote / carcass_weight_kg` por corte se hace dentro de una función Postgres `SECURITY DEFINER` invocada desde el Server Action de finalizar desposte, dentro de la misma transacción. El cliente nunca calcula ni envía el costo.
**Razón:** Garantía adicional de que las cajeras no puedan inyectar costos manipulados ni leerlos por error.

### D-005 · `physical_count_items.physical_quantity` es NULLABLE
**Fecha:** 2026-05-15
**Decisión:** Contra la letra de la spec §6.10 (que dice `NOT NULL`), la columna queda nullable con CHECK `(physical_quantity IS NULL OR physical_quantity >= 0)`.
**Razón:** El flujo §8.7 crea los items con la cantidad física **vacía** y la cajera los llena progresivamente (puede guardar progreso e interrumpir). La validación §9.2 ("todos los productos deben tener cantidad antes de finalizar") confirma que el vacío es un estado válido durante el conteo. Forzar NOT NULL obligaría a un default (ej. 0), que es un valor de conteo legítimo y rompería la distinción entre "no contado" y "contado en 0". La función de cierre del conteo (Bloque F) exige que todos los items tengan `physical_quantity` antes de pasar a `completed`.

### D-006 · `created_by` es `NOT NULL` en todas las tablas transaccionales
**Fecha:** 2026-05-15
**Decisión:** `created_by uuid NOT NULL REFERENCES profiles(id)` en `purchase_lots`, `direct_purchases`, `despostes`, `inventory_movements`, `physical_counts`, y `uploaded_by` en `receipts`.
**Razón:** El `CLAUDE.md` exige que toda inserción registre `created_by = auth.uid()`. Hacerlo NOT NULL convierte la bitácora en un invariante de base de datos, no solo de aplicación. Las tablas de catálogo (`providers`, `products`) no llevan `created_by` según spec §6.2/§6.3, así que el seed SQL no choca con esta restricción.

### D-004 · Inserciones a `inventory_movements` solo vía funciones `SECURITY DEFINER`
**Fecha:** 2026-05-15
**Decisión:** Las policies sobre `inventory_movements` no permiten INSERT directo desde clientes con sesión `employee`. Las inserciones se hacen mediante funciones Postgres `SECURITY DEFINER` específicas para cada tipo de movimiento (`fn_insert_entry_direct`, `fn_finalize_desposte`, `fn_apply_count_adjustment`). Estas funciones son las únicas vías de escritura.
**Razón:** Encapsular la lógica de inventario, evitar manipulación del `unit_cost` desde el cliente y mantener la integridad como invariante a nivel de DB, no solo de aplicación.

---

### D-007 · Modelo de seguridad admin/employee en Supabase (RLS, no GRANT por rol)
**Fecha:** 2026-05-15
**Decisión:** La spec §7.3/§7.4 describe "GRANT solo sobre la vista" para separar admin/employee. En Supabase eso es imposible: todos los usuarios logueados comparten un único rol de BD (`authenticated`); admin vs employee es de aplicación (`profiles.role`). Implementación real: función `is_admin()` SECURITY DEFINER + RLS. Las tablas con dinero (`purchase_lots`, `direct_purchases`, `inventory_movements`) solo permiten SELECT al admin vía RLS; las cajeras leen esos datos por vistas `*_employee` (definer, sin columnas monetarias). Cumple la intención de la spec (cajeras nunca ven dinero) con el mecanismo correcto para Supabase.
**Impacto negocio:** ninguno — el resultado para el usuario es exactamente el que pide la spec.

### D-008 · Anti-fraude reforzado en conteo físico a nivel de base de datos
**Fecha:** 2026-05-15
**Decisión:** La spec §8.7 dice que la cajera "no debe ver el teórico durante el conteo" y lo plantea como regla de UI. Se refuerza también en la BD: `theoretical_quantity` se oculta a `authenticated` con GRANT a nivel de columna; las cajeras leen el conteo por `v_physical_count_items_employee` (sin teórico) y solo pueden escribir `physical_quantity`/`notes`. Félix ve el teórico/físico/diferencia por `v_physical_count_items_admin` (vista admin-only). Razón: la regla anti-fraude es un driver central del negocio (CLAUDE.md §2.5 — robos de empleados); enforcement solo-UI es débil (la cajera podría llamar la API directo).
**Impacto negocio:** positivo — cierra un hueco de manipulación que la spec dejaba solo en UI.

### D-009 · ~~Usuarios semilla creados por SQL~~ — REVERTIDA por D-012
**Fecha:** 2026-05-15 · **Revertida:** 2026-05-16
**Qué decía:** `seed.sql` creaba los 3 usuarios insertando directo en `auth.users` + `auth.identities` con `pgcrypto`.
**Por qué se revirtió:** En la práctica esas filas quedan incompletas para la versión de GoTrue de Supabase (faltan columnas de token que GoTrue espera no-nulas). Resultado: login y admin API devuelven 500 "Database error querying schema / finding users". Confirmado en el proyecto real de Félix el 2026-05-16. Reemplazada por D-012.

### D-012 · Usuarios creados por la Admin API (scripts/seed-users.mjs)
**Fecha:** 2026-05-16
**Decisión:** Los usuarios se crean SOLO por la API de administración oficial de Supabase, vía `scripts/seed-users.mjs` (usa la service_role key de `.env.local`). `seed.sql` ya no toca `auth.*`; solo siembra proveedores y productos. El profile lo sigue creando el trigger `on_auth_user_created` a partir de `user_metadata` (el trigger NO era el problema; se confirmó descartándolo). Idempotente: el script omite usuarios ya existentes.
**Razón:** La Admin API rellena correctamente todas las columnas internas de `auth` que GoTrue necesita. Insertar a mano por SQL es frágil entre versiones y rompió el login en producción. Recuperación aplicada: borrar las filas malas de `auth.users/identities`, recrear por Admin API. Trade-off: el seed ya no es "un solo paste de SQL"; requiere además `node scripts/seed-users.mjs` (documentado en README).

### D-013 · `providers.type` en desuso — UI lo ignora, se fija 'other' interno
**Fecha:** 2026-05-16
**Decisión:** El campo `providers.type` dejó de ser relevante para el negocio. Por petición de Félix NO se modifica el esquema (la columna y su CHECK NOT NULL quedan tal cual, para no romper nada ni arriesgar otra incidencia tipo login). La UI del módulo de proveedores ignora el campo por completo: no lo muestra, no lo deja elegir. El Server Action de crear/editar proveedor escribe `type = 'other'` de forma interna e invisible para satisfacer el NOT NULL. Proveedores = lista simple: nombre, teléfono opcional, activo/inactivo.
**Razón:** Cambiar el esquema (default o drop constraint) es riesgo innecesario en producción cuando un valor fijo interno resuelve igual. Si en el futuro se decide limpiar el esquema, se hará en una migración aparte. El seed real de proveedores también usa `type='other'`.

### D-010 · Inmutabilidad por estado (append-only donde corresponde)
**Fecha:** 2026-05-15
**Decisión:** `inventory_movements` y `direct_purchases` no tienen policies de UPDATE/DELETE (solo se corrigen con ajustes nuevos). `despostes`/`desposte_items` y `physical_counts`/`physical_count_items` solo se editan/borran mientras están `in_progress`; al finalizar quedan congelados. Se permite borrar un desposte/conteo `in_progress` (cancelar algo iniciado por error) — no está en la spec pero es UX mínima sin riesgo (sin dinero, sin movimientos generados).
**Razón:** Cumple §9.5 (inmutabilidad) y §2.5 (cajeras solo crean, no modifican). El borrado de borradores en curso evita registros zombi.

### D-011 · RPCs (funciones) como única vía de escritura sensible
**Fecha:** 2026-05-15
**Decisión:** Crear/activar lotes, compras directas, despostes y conteos pasan por funciones SECURITY DEFINER (`fn_*`) invocadas por RPC desde Server Actions. El cliente nunca inserta en `inventory_movements` ni calcula costos. Las funciones validan rol y reglas de negocio dentro de una transacción atómica.
**Razón:** Encapsula la lógica de inventario, garantiza atomicidad (ej. finalizar desposte = generar N movimientos + cerrar lote, todo o nada) y mantiene el costo fuera del alcance del cliente.

## Deudas técnicas

### DT-001 · Contraseñas iniciales sin flow de cambio obligatorio
**Fecha:** 2026-05-15
**Descripción:** Los tres usuarios semilla se crean con contraseña provisional `Carneguey2026!`. No existe en v1.0 un flujo de "cambio obligatorio en primer login". Félix cambia las contraseñas manualmente desde Supabase Studio después del primer login de cada usuaria.
**Riesgo:** Si una contraseña inicial se filtra antes del cambio manual, el atacante tiene acceso a la cuenta hasta que Félix la rote.
**Acción futura:** Implementar `force_password_change` flag en `profiles` y middleware que redirige a `/cambiar-clave` mientras el flag esté en true. Evaluar para v1.1.

### DT-004 · PIN corto de 4 dígitos para el admin (decisión del dueño)
**Fecha:** 2026-05-16
**Descripción:** Félix pidió cambiar su usuario a `felix@carneguey.com` con contraseña `2723` (4 dígitos). Se le explicó el riesgo de seguridad de un PIN tan corto en un sistema con datos financieros; lo aceptó explícitamente. Se bajó el mínimo de la validación de la app (zod) de 6 a 4 caracteres. Las cajeras siguen con `Carneguey2026!`.
**Por qué funciona sin tocar config de Supabase:** las contraseñas se fijan por SQL directo con `crypt()`, lo que evita la validación de longitud de la Auth API de Supabase (que solo aplica a signup/update vía API, no a sign-in ni a hash insertado por SQL).
**Riesgo asumido:** un PIN de 4 dígitos numéricos es trivial de adivinar por fuerza bruta si alguien tiene acceso a la pantalla de login. Mitigación futura sugerida: rate limiting de intentos / 2FA para el admin. Evaluar en v1.1.

### DT-002 · `pos_code` de productos queda NULL en seed
**Fecha:** 2026-05-15
**Descripción:** El catálogo semilla no incluye los códigos de eSyspos porque Félix aún no tiene el export limpio. Los productos quedan con `pos_code IS NULL` y se llenan desde el panel de admin más adelante.
**Acción futura:** Cuando Félix consiga el export, importar masivamente con un script o desde admin.

### DT-003 · Botón "Eliminar definitivamente" en /admin/productos
**Fecha:** 2026-05-16
**Descripción:** Pendiente para el módulo `/admin/productos`: agregar un botón "Eliminar definitivamente" que solo aparezca cuando el producto NO tenga movimientos de inventario, despostes ni compras asociadas. Por defecto, los productos se desactivan (`active = false`), no se eliminan, para preservar la integridad del histórico.
**Acción futura:** Implementar en el paso de catálogo (sección 15.3 #4), con la verificación de "sin referencias" antes de permitir el borrado físico.

---

## Dudas pendientes

(Sin entradas por ahora — todas las dudas se resolvieron en la sesión inicial del 2026-05-15.)

---

## Ideas fuera de alcance v1.0 (parking lot)

Espacio para anotar ideas que surjan durante el desarrollo y que NO entran en v1.0 (ver sección 3.2 del spec). No se implementan hasta versiones posteriores.

- _(vacío por ahora)_
