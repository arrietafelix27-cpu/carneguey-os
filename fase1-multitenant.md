# Fase 1 — Cimiento multi-negocio (Miura)

## Contexto para ti, Claude Code

Este proyecto (`carneguey-os`) va a convertirse en **Miura**, un SaaS
multi-negocio para carnicerías colombianas. Hoy la base de datos asume
un solo negocio. Esta fase agrega aislamiento total de datos entre
negocios (organizations), sin construir todavía onboarding, superadmin
ni cambios visuales. Al terminar esta fase la app debe seguir
funcionando exactamente igual para el negocio actual (Carnegüey), pero
la base queda lista para que un segundo negocio use el sistema sin ver
ni un solo dato del primero.

**No hay base de datos de producción en riesgo** — Carnegüey se vendió
antes de terminar el despliegue, así que no hay operación real que
proteger durante la migración. Aun así, trabaja con migraciones nuevas
(nunca edites migraciones existentes) y mantén el patrón de RPCs
`SECURITY DEFINER` ya establecido en el proyecto.

Antes de empezar: lee `CLAUDE.md`, `docs/DECISIONS.md`, y las
migraciones `001` a `029` completas. Confírmame en una línea que
entendiste el estado actual antes de escribir la primera migración.

---

## Objetivo de la fase

Que **ninguna fila de ninguna tabla pueda ser leída, escrita o inferida
por un usuario de otra organización**, sin importar el camino: RLS
directo, vista, función RPC, caché, o Storage.

## Alcance — qué SÍ entra en esta fase

1. Tabla `organizations` nueva.
2. Columna `organization_id` en todas las tablas que hoy tienen datos
   del negocio (ver lista abajo).
3. Todas las políticas RLS actualizadas para filtrar por
   `organization_id`, además del filtro por rol que ya existe.
4. Todas las funciones `SECURITY DEFINER` (`fn_*`) actualizadas para
   resolver el `organization_id` desde el usuario autenticado — nunca
   desde un parámetro que mande el cliente.
5. Arreglar `lib/cache.ts` — hoy usa `service_role` para cachear
   catálogo sin distinguir negocio. Esto hay que resolverlo aquí,
   antes de que exista un segundo cliente.
6. Storage (`receipts` bucket): las rutas y políticas deben quedar
   aisladas por organización.
7. Migrar los datos existentes de Carnegüey a una organización real
   (no un valor genérico) para no dejar filas huérfanas.

## Fuera de alcance — NO construir en esta fase

- Pantalla de registro / onboarding de negocio nuevo (Fase 4).
- Panel superadmin (Fase 5).
- Unificación de rutas `/admin` y `/empleado` (Fase 2).
- Cualquier cambio visual.

Si durante el trabajo detectas que algo de esto se necesita antes de
tiempo, anótalo en `DECISIONS.md` y pregúntame — no lo construyas.

---

## Paso a paso propuesto

### 1. Tabla `organizations`

```
organizations
  id              uuid PK
  name            text NOT NULL
  slug            text UNIQUE NOT NULL        -- para uso interno, no URL pública todavía
  status          text NOT NULL DEFAULT 'trial'
                  CHECK (status IN ('trial','active','past_due','suspended','cancelled'))
  trial_ends_at   timestamptz
  created_at      timestamptz NOT NULL DEFAULT now()
```

`status` ya se deja modelado con los valores que va a necesitar la
Fase 5 (superadmin) y el modo solo-lectura al vencer el trial, aunque
en esta fase nadie los use todavía salvo el seed.

### 2. `organization_id` — tablas a modificar

Agregar `organization_id uuid NOT NULL REFERENCES organizations(id)`
(nullable primero, backfill, luego NOT NULL) en:

`profiles`, `providers`, `products`, `purchase_lots`,
`direct_purchases`, `despostes`, `desposte_items`, `cut_transfers`,
`sub_despostes`, `inventory_movements`, `physical_counts`,
`physical_count_items`, `pos_sales`, `pos_sale_items`, `customers`,
`customer_payments`, `cash_outflows`, `daily_closings`,
`supplier_accounts`, `supplier_payments`, `employees`, `payroll_*`
(todas las de nómina), `app_settings`, `receipts`.

Verifica esta lista contra el esquema real — puede haber tablas que
falten o que no apliquen (p. ej. tablas puramente de catálogo estático
si las hay). Si encuentras una tabla con datos de negocio que no está
en esta lista, agrégala igual.

**Orden seguro por tabla:**
1. `ALTER TABLE ... ADD COLUMN organization_id uuid REFERENCES organizations(id);` (nullable)
2. `UPDATE` para asignar el `organization_id` de Carnegüey a todas las filas existentes
3. `ALTER TABLE ... ALTER COLUMN organization_id SET NOT NULL;`
4. Índice: `CREATE INDEX ON tabla(organization_id);`

### 3. Función helper de organización

```sql
CREATE FUNCTION current_org_id() RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;
```

Se usa en TODAS las policies nuevas y dentro de las funciones `fn_*`.
Nunca confíes en un `organization_id` que llegue como parámetro desde
el cliente — siempre resuélvelo con esta función.

### 4. RLS — patrón a aplicar

Cada policy existente que hoy dice algo como
`USING (is_admin())` o `USING (auth.uid() = created_by OR is_admin())`
pasa a:
`USING (organization_id = current_org_id() AND (is_admin() OR ...))`

Repasa policy por policy — no hay atajo, hay que tocarlas todas. Dame
al final la lista de cuántas policies tocaste y en qué migraciones.

### 5. Funciones `SECURITY DEFINER` (`fn_*`)

Cada función que inserta en `inventory_movements`, crea lotes,
finaliza despostes, aplica ajustes de conteo, etc. debe:
- Resolver `organization_id` con `current_org_id()` al inicio.
- Insertar ese valor en cada fila que cree, sin excepción.
- Si la función recibe un `id` de otra tabla como parámetro (ej. un
  `product_id`), validar que ese registro pertenece a la misma
  organización antes de usarlo — si no, lanzar error. Esto evita que
  alguien arme una compra apuntando a un producto de otro negocio.

### 6. `lib/cache.ts` — el hallazgo que ya identificamos

Hoy cachea productos/proveedores/umbrales de merma de forma global con
`service_role`, sin distinguir negocio. Opciones, en orden de
preferencia:

- **Opción A (recomendada):** la clave de caché de `unstable_cache`
  incluye el `organization_id` (ej. `["products-active", orgId]`), y
  la función recibe `orgId` como parámetro explícito que viene del
  Server Component que la llama (que sí conoce la sesión).
- **Opción B:** quitar el caché por ahora y consultar directo con RLS
  normal (más simple, algo más lento). Válido si el volumen de datos
  por negocio es pequeño, que es el caso de una carnicería.

Decide tú cuál es más simple de mantener y dime cuál elegiste y por
qué.

### 7. Storage (`receipts`)

Las rutas de archivos deben incluir el `organization_id`, ej.
`receipts/{organization_id}/{purchase_id}/foto.jpg`, y las policies de
Storage deben validar que el usuario solo puede leer/escribir dentro
de la carpeta de su propia organización.

### 8. Seed y datos existentes

Crea una organización real para los datos actuales (nombre: el que tú
decidas, ej. "Carnegüey — datos de prueba" o el que prefieras) y migra
todo lo existente ahí. Actualiza `scripts/seed-users.mjs` si crea
usuarios, para que asigne `organization_id` al crear el profile.

---

## Casos límite a resolver (no esperes a que te los pida)

- ¿Qué pasa si un usuario autenticado no tiene `organization_id` en su
  profile (dato corrupto o migración a medias)? Debe bloquearse el
  acceso con un error claro, nunca caer a "ver todo" o "ver nada
  silenciosamente".
- ¿Qué pasa si dos negocios comparten el mismo proveedor real (ej.
  ambos le compran a la misma finca)? Para esta fase, cada negocio
  tiene su propia fila de proveedor aunque el nombre se repita — no
  hay proveedores compartidos entre organizaciones. Anota esto en
  `DECISIONS.md` por si en el futuro se replantea.
- Verifica que ninguna Server Action existente permita que el cliente
  mande su propio `organization_id` en el body — debe ignorarse
  cualquier valor que llegue del frontend para ese campo.

## Verificación antes de dar la fase por cerrada

Antes de decirme que terminaste, corre (o dime cómo correr) una
prueba manual mínima: crear una segunda organización de prueba con un
usuario de prueba, y confirmar que:
1. Ese usuario no ve ningún producto, proveedor, venta ni cliente de
   Carnegüey.
2. Un intento manual de leer datos de Carnegüey desde la sesión de
   prueba (por RPC o query directa) falla, no solo "no se muestra en
   pantalla".
3. La app de Carnegüey (usuario real) sigue funcionando exactamente
   igual que antes de esta fase.

## Al terminar

Dame el resumen en lenguaje de negocio: qué tablas y funciones
tocaste, cuántas migraciones nuevas quedaron, qué decisiones tomaste
en `lib/cache.ts`, y qué debo revisar yo antes de seguir a la Fase 2
(unificar la app).
