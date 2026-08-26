# Carnegüey OS — Especificación de Requisitos v1.0

> ⚠️ **DOCUMENTO HISTÓRICO — NO ES LA DEFINICIÓN DE ALCANCE ACTUAL.**
>
> Este documento describe la v1.0 original: un módulo de inventario para **una sola
> carnicería** (Carnegüey, el negocio del papá de Félix, ya vendido). El producto
> evolucionó a **Miura**, un sistema de gestión completo para carnicerías que se
> vende a varios clientes, cada uno en su propia instancia (D-021).
>
> Se conserva porque el **modelo de datos y los flujos de inventario** que describe
> siguen siendo la base real del sistema y son buena referencia.
>
> Para el estado actual y la hoja de ruta: [`carneguey-os-status.md`](carneguey-os-status.md).
> Para lo que cambió desde entonces: [`DECISIONS.md`](DECISIONS.md), D-016 en adelante.

**Módulo de Inventario — Primera versión funcional**

---

## 1. Resumen ejecutivo

Carnegüey OS es un sistema de gestión integral para Carnegüey, una carnicería ubicada en Sincelejo (Sucre, Colombia) con 10 años de operación, 9 empleados y un POS existente (eSyspos) que se mantiene en uso.

Esta versión 1.0 entrega únicamente el **Módulo de Inventario**, base sobre la que se construirán los módulos siguientes (Cuadre Digital, Ventas a Crédito, Compras/Proveedores, Dashboard).

El objetivo de la v1.0 es permitir el registro completo del ciclo de inventario: compra de mercancía (ganado en pie, canales, pollo, otros productos), desposte parcial de lotes, control de inventario teórico actual con valoración monetaria, y conciliación contra conteo físico.

El cruce automático con el reporte de ventas del POS (eSyspos) NO está incluido en esta v1.0 y se implementará en una versión posterior.

---

## 2. Contexto del negocio

### 2.1. Sobre Carnegüey

Carnicería que vende productos de res, cerdo, pollo y derivados (chorizos, arepas, queso, suero, etc.). Cuenta con un POS llamado eSyspos conectado a básculas con código de barras. Tiene un mostrador físico, atiende clientes de pie y vende a domicilio, restaurantes y fundaciones (algunos con precio especial y crédito).

### 2.2. Actores del sistema

- **Felix** (propietario, rol `admin`): controla el negocio desde su celular. Compra el ganado en pie, ve toda la información financiera, ejecuta el control y la auditoría.
- **Cajeras** (dos personas, rol `employee`): operan la app desde el computador del negocio. Mientras una atiende el mostrador, la otra registra movimientos.
- **Jefe de proceso y carniceros** (no usan la app): el carnicero anota en papel los pesos de los despostes y se los pasa a la cajera libre, quien los digita.

### 2.3. Operación de mercancía

- **Res en pie**: Felix compra el ganado vivo. El animal va a un matadero externo. Días después llegan las canales al negocio. Las canales NO vienen numeradas — vienen partidas en 3 o 4 piezas. El control se hace por peso total, no por animal individual.
- **Res en canal directo**: ocasionalmente se compran canales directamente sin haber comprado el animal en pie.
- **Cerdo en canal**: llegan cerdos completos o medias canales, semanalmente.
- **Pollo**: llega casi diario, principalmente de Mac Pollo. También gallina criolla de otro proveedor.
- **Otros productos**: arepas, chorizos, queso, suero, etc. Compras por unidad o kilogramo según el producto.

### 2.4. Despostes

Los despostes de res se hacen en tandas durante varios días para evitar deshidratación y manipulación excesiva. Un lote de 15 reses puede despostarse en 5-6 tandas a lo largo de 15 días. Los despostes de cerdo suelen hacerse el mismo día o en pocos días. El pollo y otros productos no se despostan: entran y salen como están.

**Importante sobre la merma**: en Carnegüey no se descarta nada. Lo que tradicionalmente sería "merma" (sebo, recortes, lo que no sirve como corte fino) se aprovecha como sebo de cocina o se va a la molida corriente, y se vende. Por lo tanto, la app NO permite registrar merma manualmente. La merma se calcula automáticamente como la diferencia entre el peso que entró al desposte y la suma de los pesos de los cortes registrados.

### 2.5. Restricciones de confianza

Felix ha sufrido robos por parte de empleados en el pasado. La app debe diseñarse bajo el principio de que las cajeras pueden cometer errores u omisiones, y debe haber controles que minimicen el espacio para manipulación deliberada. Específicamente:

- Las cajeras NO pueden ver costos, valores en pesos, márgenes ni rentabilidad. Solo cantidades en kg o unidades, y nombres de productos.
- Las cajeras NO pueden modificar ni eliminar registros, solo crear nuevos.
- Toda acción queda con bitácora: quién la hizo y cuándo.
- Felix puede ver todo desde admin y puede crear correcciones (que quedan registradas como ajuste, no borran el original).

---

## 3. Alcance de esta versión (v1.0)

### 3.1. Funcionalidades incluidas

**Autenticación y roles**
- Login con email y contraseña
- Dos roles: `admin` y `employee`
- Vistas diferenciadas por rol

**Catálogo**
- Gestión de proveedores (crear, editar, listar)
- Gestión de productos/cortes (crear, editar, listar, agrupados por categoría)

**Lotes de res y cerdo**
- Crear lote de res en pie (solo admin)
- Registrar llegada de canales a un lote en pie pendiente (empleado o admin)
- Crear lote de res en canal directo (empleado o admin)
- Crear lote de cerdo en canal (empleado o admin)
- Ver lotes activos y cerrados
- Cierre automático de lote cuando se agota

**Entrada directa (pollo y otros)**
- Registrar compra de pollo/derivados con entrada directa al inventario
- Registrar compra de otros productos (arepas, chorizos, etc.)

**Despostes**
- Registrar desposte parcial de un lote activo
- Agregar cortes uno por uno con su peso
- Contador en tiempo real de peso restante
- Finalización del desposte con cálculo automático de merma

**Inventario actual**
- Vista de inventario teórico por producto
- Vista de admin incluye costo por kg y valor total
- Filtros por categoría

**Conteo físico**
- Iniciar un conteo físico (empleado)
- Digitar cantidad física por producto
- Felix puede ver inventario teórico antes y después del conteo
- Resultado del conteo: diferencias por producto con porcentajes

**Comprobantes**
- Adjuntar foto del recibo en compras (lotes y entradas directas)
- Visualización de fotos para admin

### 3.2. Fuera de alcance (NO incluir en v1.0)

- Cruce automático con reporte del POS (eSyspos)
- Módulo de cuadre digital de caja
- Módulo de ventas a crédito y cuentas por cobrar
- Módulo de cuentas por pagar
- Dashboard con métricas, gráficos y comparativos
- Sistema de alertas automáticas por WhatsApp
- Notificaciones push
- Reportes exportables a PDF o Excel
- Integración con WhatsApp Business API
- Multi-sucursal
- Backup automático configurable por usuario

---

## 4. Stack técnico y dependencias

### 4.1. Stack obligatorio

- **Framework**: Next.js 15 con App Router y TypeScript
- **Backend / Base de datos**: Supabase (PostgreSQL, Auth, Storage)
- **Estilos**: Tailwind CSS v4
- **Componentes UI**: shadcn/ui
- **Iconos**: lucide-react
- **Formularios**: react-hook-form + zod para validación
- **Fechas**: date-fns
- **Despliegue**: Vercel

### 4.2. Soporte de dispositivos

- **Mobile-first**: la app se diseña primero para celular (Felix) y se adapta a desktop (cajeras en el computador del negocio).
- **PWA**: la aplicación debe ser instalable como Progressive Web App. Felix la instala en su celular y las cajeras crean acceso directo en el escritorio del computador del negocio.
- **Offline**: NO se requiere modo offline en v1.0. La app requiere conexión a internet.

### 4.3. Idioma

- Toda la interfaz en español de Colombia
- Formato de fecha: DD/MM/AAAA
- Formato de moneda: peso colombiano (COP) con separador de miles con punto (ej: $34.900.000)
- Formato de peso: kilogramos con dos decimales máximo, separador decimal con coma (ej: 3.600,50 kg)

---

## 5. Arquitectura de la aplicación

### 5.1. Estructura de rutas (App Router de Next.js)

```
/                           → redirige según rol
/login                      → pantalla de login
/admin                      → home admin (Felix)
/admin/inventario           → inventario actual con valoración
/admin/lotes                → lista de todos los lotes
/admin/lotes/[id]           → detalle de un lote con costos
/admin/lotes/nuevo-en-pie   → crear lote de res en pie (solo admin)
/admin/conteos              → lista de conteos físicos
/admin/conteos/[id]         → resultado de un conteo
/admin/productos            → gestión del catálogo de productos
/admin/proveedores          → gestión de proveedores
/admin/usuarios             → gestión de usuarios y roles

/empleado                   → home empleado
/empleado/compras           → menú de tipos de compra
/empleado/compras/llegada-canales → registrar llegada de canales de un lote pendiente
/empleado/compras/canal-directo   → registrar lote de canal directo
/empleado/compras/cerdo           → registrar lote de cerdo
/empleado/compras/entrada-directa → registrar pollo u otros productos
/empleado/desposte                → nuevo desposte
/empleado/desposte/[id]           → desposte en curso
/empleado/inventario              → inventario actual (sin costos)
/empleado/conteo                  → iniciar nuevo conteo físico
/empleado/conteo/[id]             → conteo físico en curso
```

### 5.2. Estructura de carpetas

```
/app
  /(auth)
    /login
  /(admin)/admin
    /...
  /(employee)/empleado
    /...
  /api
    /...
/components
  /ui              → componentes shadcn/ui
  /shared          → componentes compartidos (Header, etc.)
  /admin           → componentes específicos de admin
  /employee        → componentes específicos de empleado
/lib
  /supabase        → cliente Supabase (browser, server, middleware)
  /utils           → utilidades varias (formatters, etc.)
  /validations     → schemas zod
/types             → tipos TypeScript globales
/hooks             → custom hooks
/middleware.ts     → middleware de autenticación
```

### 5.3. Modelo de seguridad

- Autenticación gestionada por Supabase Auth con email + contraseña.
- Row Level Security (RLS) activada en todas las tablas.
- Policies de Supabase que controlan el acceso por rol:
  - `admin`: lectura y escritura completa en todas las tablas.
  - `employee`: lectura y escritura limitada según las reglas de cada flujo. NO puede leer columnas de costos ni precios.
- El middleware de Next.js protege las rutas: `/admin/*` solo accesible para `admin`, `/empleado/*` para ambos roles.
- Las llamadas a Supabase desde el cliente usan la sesión del usuario autenticado, no la service role key.

---

## 6. Modelo de datos (PostgreSQL en Supabase)

A continuación se especifican todas las tablas. Todas incluyen `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` y `created_at timestamptz DEFAULT now()` por defecto.

### 6.1. `profiles`

Extiende `auth.users` de Supabase con datos del perfil.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK, FK a `auth.users.id`, ON DELETE CASCADE |
| full_name | text | NOT NULL |
| role | text | NOT NULL, CHECK in ('admin', 'employee') |
| active | boolean | DEFAULT true |
| created_at | timestamptz | |

### 6.2. `providers`

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| name | text | NOT NULL |
| phone | text | nullable |
| type | text | NOT NULL, CHECK in ('live_cattle', 'beef_carcass', 'pork_carcass', 'poultry', 'other') |
| notes | text | nullable |
| active | boolean | DEFAULT true |
| created_at | timestamptz | |

### 6.3. `products`

Catálogo maestro de todos los productos: cortes de res, cortes de cerdo, productos de pollo, otros productos.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| pos_code | text | UNIQUE, nullable. Código del producto en eSyspos para futura sincronización |
| name | text | NOT NULL (ej: "Lomo fino", "Pierna de cerdo", "Pechuga", "Arepa") |
| category | text | NOT NULL, CHECK in ('beef', 'pork', 'poultry', 'other') |
| unit | text | NOT NULL, CHECK in ('kg', 'unit') |
| origin | text | NOT NULL, CHECK in ('from_processing', 'direct_purchase'). `from_processing` para cortes que salen de despostes (solo res y cerdo); `direct_purchase` para pollo y otros productos |
| active | boolean | DEFAULT true |
| created_at | timestamptz | |

### 6.4. `purchase_lots`

Lotes de compra de res (en pie o canal) y cerdo.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| lot_code | text | UNIQUE NOT NULL. Formato: `RES-{año}-{secuencia}` o `CER-{año}-{secuencia}` (ej: `RES-2026-047`) |
| type | text | NOT NULL, CHECK in ('beef_live', 'beef_carcass', 'pork_carcass') |
| provider_id | uuid | NOT NULL, FK a `providers.id` |
| status | text | NOT NULL, CHECK in ('pending_arrival', 'active', 'closed'). DEFAULT 'active' para canales; 'pending_arrival' para `beef_live` hasta que llegue. |
| | | **Para beef_live (ganado en pie):** |
| live_animal_count | int | nullable, requerido si type='beef_live' |
| live_weight_kg | numeric(10,2) | nullable, requerido si type='beef_live' |
| live_purchase_cost | numeric(12,2) | nullable, requerido si type='beef_live' |
| transport_to_slaughter_cost | numeric(12,2) | nullable, default 0 si type='beef_live' |
| slaughter_cost | numeric(12,2) | nullable, default 0 si type='beef_live' |
| transport_to_shop_cost | numeric(12,2) | nullable, default 0 si type='beef_live' |
| other_costs | numeric(12,2) | nullable, default 0 si type='beef_live' |
| live_purchase_date | date | nullable, requerido si type='beef_live' |
| | | **Para beef_carcass / pork_carcass (canal directo):** |
| carcass_purchase_cost | numeric(12,2) | nullable, requerido si type in ('beef_carcass', 'pork_carcass') |
| carcass_transport_cost | numeric(12,2) | nullable, default 0 |
| | | **Llegada al negocio (todos los tipos):** |
| carcass_count | int | nullable, NOT NULL cuando status='active' o 'closed'. Para cerdo: número de cerdos. Para res en pie: número de canales (puede no coincidir con live_animal_count si hubo decomisos). |
| carcass_weight_kg | numeric(10,2) | nullable, NOT NULL cuando status='active' o 'closed' |
| arrival_date | date | nullable, NOT NULL cuando status='active' o 'closed' |
| | | **Metadatos:** |
| notes | text | nullable |
| created_by | uuid | FK a `profiles.id` |
| created_at | timestamptz | |
| activated_by | uuid | nullable, FK a `profiles.id`. Quien registró la llegada de canales |
| activated_at | timestamptz | nullable |
| closed_at | timestamptz | nullable. Se establece automáticamente cuando se cierra el lote |

**Campos calculados (no almacenados, computados en queries o en vistas):**
- `total_cost` = suma de todos los costos según el tipo
- `cost_per_kg_carcass` = `total_cost / carcass_weight_kg`
- `slaughter_yield_pct` = `carcass_weight_kg / live_weight_kg` (solo para beef_live)
- `kg_remaining` = `carcass_weight_kg - SUM(despostes.input_weight_kg)` para los despostes finalizados de este lote

### 6.5. `direct_purchases`

Compras de pollo y otros productos que entran directamente al inventario sin desposte.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| provider_id | uuid | NOT NULL, FK |
| product_id | uuid | NOT NULL, FK a `products` |
| quantity | numeric(10,2) | NOT NULL |
| total_cost | numeric(12,2) | NOT NULL |
| purchase_date | date | NOT NULL |
| notes | text | nullable |
| created_by | uuid | FK |
| created_at | timestamptz | |

**Campo calculado:** `unit_cost = total_cost / quantity`

### 6.6. `despostes`

Despostes parciales de lotes de res o cerdo.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| lot_id | uuid | NOT NULL, FK a `purchase_lots.id` |
| input_weight_kg | numeric(10,2) | NOT NULL. Peso que entró a la mesa de desposte |
| status | text | NOT NULL, CHECK in ('in_progress', 'finalized'). DEFAULT 'in_progress' |
| desposte_date | date | NOT NULL, DEFAULT CURRENT_DATE |
| notes | text | nullable |
| created_by | uuid | FK |
| created_at | timestamptz | |
| finalized_at | timestamptz | nullable |

**Campos calculados:**
- `total_output_kg` = suma de `weight_kg` de todos los `desposte_items` asociados
- `merma_kg` = `input_weight_kg - total_output_kg` (solo se considera definitiva cuando status='finalized')

### 6.7. `desposte_items`

Cortes que salen de un desposte.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| desposte_id | uuid | NOT NULL, FK |
| product_id | uuid | NOT NULL, FK a `products`. Solo productos con `origin='from_processing'` y categoría coincidente con el lote |
| weight_kg | numeric(10,2) | NOT NULL, > 0 |
| created_at | timestamptz | |

### 6.8. `inventory_movements`

Registro inmutable de todos los movimientos de inventario. Es la tabla source-of-truth del inventario.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| product_id | uuid | NOT NULL, FK |
| movement_type | text | NOT NULL, CHECK in ('entry_direct', 'entry_desposte', 'adjustment_in', 'adjustment_out', 'physical_count_adjustment') |
| quantity | numeric(10,2) | NOT NULL. Positivo = entrada, negativo = salida |
| unit_cost | numeric(12,4) | NOT NULL. Costo por unidad al momento del movimiento |
| reference_type | text | nullable, CHECK in ('direct_purchase', 'desposte_item', 'adjustment', 'physical_count') |
| reference_id | uuid | nullable |
| notes | text | nullable |
| created_by | uuid | FK |
| created_at | timestamptz | |

**Regla**: nunca se modifica ni borra un movimiento. Para corregir se crea un movimiento de ajuste inverso.

### 6.9. `physical_counts`

Conteos físicos del inventario.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| count_date | date | NOT NULL, DEFAULT CURRENT_DATE |
| status | text | NOT NULL, CHECK in ('in_progress', 'completed'). DEFAULT 'in_progress' |
| notes | text | nullable |
| created_by | uuid | FK |
| created_at | timestamptz | |
| completed_at | timestamptz | nullable |

### 6.10. `physical_count_items`

Cada producto contado en un conteo físico.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| physical_count_id | uuid | NOT NULL, FK |
| product_id | uuid | NOT NULL, FK |
| theoretical_quantity | numeric(10,2) | NOT NULL. Snapshot del inventario teórico al iniciar el conteo |
| physical_quantity | numeric(10,2) | NOT NULL. Lo que se contó físicamente |
| notes | text | nullable |
| created_at | timestamptz | |

**Campos calculados:**
- `difference = physical_quantity - theoretical_quantity`
- `difference_pct = (difference / theoretical_quantity) * 100` (manejar división por cero)

### 6.11. `receipts`

Fotos de comprobantes adjuntas a compras.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| entity_type | text | NOT NULL, CHECK in ('purchase_lot', 'direct_purchase') |
| entity_id | uuid | NOT NULL |
| file_path | text | NOT NULL. Ruta del archivo en Supabase Storage |
| uploaded_by | uuid | FK |
| created_at | timestamptz | |

### 6.12. Vistas SQL

Crear las siguientes vistas para facilitar consultas:

**`v_current_inventory`**
Inventario teórico actual por producto: suma de todos los `inventory_movements` agrupados por producto. Incluye `quantity_in_stock`, `weighted_avg_unit_cost`, `total_value`.

**`v_lot_summary`**
Resumen de cada lote: totales de costos, peso despostado vs disponible, número de despostes finalizados.

**`v_desposte_summary`**
Resumen de cada desposte: peso entrada, peso salida total, merma calculada, status.

### 6.13. Storage de Supabase

Crear un bucket llamado `receipts` con acceso privado. Solo usuarios autenticados pueden leer/escribir. Las fotos se suben con ruta: `{entity_type}/{entity_id}/{timestamp}_{filename}`.

---

## 7. Autenticación, roles y seguridad

### 7.1. Login

- Pantalla `/login` con email y contraseña
- Validación: email obligatorio con formato válido, contraseña mínimo 6 caracteres
- Mensaje de error genérico (no revelar si el email existe o no)
- Sesión persistente
- Botón "Cerrar sesión" siempre visible en el header

### 7.2. Roles y redirecciones

- Al hacer login exitoso, leer el `role` del perfil:
  - Si `admin` → redirige a `/admin`
  - Si `employee` → redirige a `/empleado`
- Middleware bloquea acceso cruzado: empleado intentando entrar a `/admin/*` recibe 403 o redirección a `/empleado`
- Usuario no autenticado intentando cualquier ruta protegida → redirige a `/login`

### 7.3. Row Level Security (RLS)

Activar RLS en todas las tablas. Policies generales:

**profiles**
- Lectura: todos los autenticados pueden leer su propio perfil; admin puede leer todos
- Escritura: solo admin

**providers, products**
- Lectura: todos los autenticados
- Escritura: solo admin

**purchase_lots**
- Lectura: admin lee todo (incluido costos). Employee lee todo EXCEPTO columnas de costos. Esto se logra creando una vista `v_purchase_lots_employee` que excluye costos y otorgando permisos solo sobre la vista.
- Inserción: admin puede insertar cualquier tipo. Employee solo puede insertar `beef_carcass` y `pork_carcass` (no `beef_live`).
- Actualización (registrar llegada): admin y employee pueden actualizar lotes de tipo `beef_live` en status `pending_arrival` para establecer los campos de llegada.

**direct_purchases**
- Lectura: admin lee todo. Employee lee sin columna `total_cost`.
- Inserción: admin y employee.

**despostes, desposte_items**
- Lectura y escritura: admin y employee.

**inventory_movements**
- Lectura: admin lee todo. Employee lee todo EXCEPTO `unit_cost`.
- Inserción: solo a través de funciones de servidor (no directo desde cliente).

**physical_counts, physical_count_items**
- Lectura y escritura: admin y employee.

**receipts**
- Lectura: admin y employee.
- Inserción: admin y employee.

### 7.4. Vista del empleado: ocultar datos sensibles

Las cajeras NUNCA deben ver:
- Costos por kg, precios de compra, valores en pesos del inventario
- Márgenes, rentabilidad, utilidad
- Columnas `live_purchase_cost`, `slaughter_cost`, `carcass_purchase_cost`, `total_cost`, `unit_cost`, `weighted_avg_unit_cost`, `total_value`
- Información financiera de cualquier tipo

Esto se garantiza a nivel de UI (componentes diferentes) Y a nivel de base de datos (vistas restringidas + policies).

### 7.5. Bitácora

Cada inserción debe registrar `created_by` con el id del usuario autenticado. Esto se obtiene de `auth.uid()` en las policies y triggers.

---

## 8. Casos de uso y flujos funcionales

### 8.1. Flujo: Felix registra compra de ganado en pie

**Actor**: Admin (Felix), desde su celular.

**Ruta**: `/admin/lotes/nuevo-en-pie`

**Pasos**:
1. Felix abre el formulario
2. Selecciona proveedor (dropdown con providers tipo `live_cattle`, opción de agregar nuevo)
3. Ingresa número de animales
4. Ingresa peso vivo total (kg)
5. Ingresa precio total pagado por el ganado
6. Ingresa costos adicionales conocidos: transporte al matadero, costo de sacrificio, transporte al negocio, otros. Cualquiera puede quedar en 0 y editarse después.
7. Selecciona la fecha de compra
8. Notas opcionales
9. Guarda

**Resultado**:
- Se crea un registro en `purchase_lots` con `type='beef_live'`, `status='pending_arrival'`
- Se genera `lot_code` automáticamente (RES-{año}-{secuencia})
- El lote aparece en la lista de "Lotes pendientes de recibir" en la vista del empleado
- No se crean movimientos de inventario aún (el inventario solo se afecta cuando llegan las canales y se despostan)

### 8.2. Flujo: Cajera registra llegada de canales a un lote en pie pendiente

**Actor**: Empleado (cajera), desde el computador del negocio.

**Ruta**: `/empleado/compras/llegada-canales`

**Pasos**:
1. La cajera ve una lista de lotes pendientes de recibir (status='pending_arrival')
2. Selecciona el lote correspondiente (ej: RES-2026-047)
3. Ve resumen del lote (proveedor, número de animales esperado, fecha de compra) sin ver costos
4. Ingresa fecha de llegada
5. Ingresa número de canales recibidas (puede diferir del número de animales si hubo decomisos)
6. Ingresa peso total de canales recibidas (kg)
7. Adjunta foto del comprobante de matadero (opcional pero recomendado)
8. Notas opcionales
9. Confirma

**Resultado**:
- Se actualiza el lote: `carcass_count`, `carcass_weight_kg`, `arrival_date`, `activated_by`, `activated_at`
- El lote pasa a `status='active'`
- Aparece en la lista de lotes disponibles para desposte

### 8.3. Flujo: Cajera registra compra de canales directas (res o cerdo)

**Actor**: Empleado, desde el computador.

**Ruta**: `/empleado/compras/canal-directo` (res) o `/empleado/compras/cerdo`

**Pasos**:
1. Selecciona proveedor
2. Ingresa número de canales o cerdos
3. Ingresa peso total recibido (kg)
4. Ingresa costo total (el empleado SÍ digita el costo aquí porque viene en el comprobante físico; sin embargo no lo verá después en ningún listado, solo se muestra al momento de digitar)
5. Adjunta foto del comprobante (obligatorio para canal directo)
6. Notas opcionales
7. Guarda

**Resultado**:
- Se crea registro en `purchase_lots` con `type='beef_carcass'` o `pork_carcass`, `status='active'`
- Se genera `lot_code` automáticamente
- Disponible para desposte de inmediato

### 8.4. Flujo: Cajera registra compra de pollo u otros (entrada directa)

**Actor**: Empleado.

**Ruta**: `/empleado/compras/entrada-directa`

**Pasos**:
1. Selecciona proveedor
2. Selecciona producto (filtrado por `category in ('poultry', 'other')` y `origin='direct_purchase'`)
3. Ingresa cantidad (kg o unidades según el producto)
4. Ingresa costo total
5. Adjunta foto del comprobante (opcional)
6. Notas opcionales
7. Puede agregar otro producto al mismo recibo (botón "Agregar otro producto") antes de guardar
8. Guarda

**Resultado**:
- Por cada producto se crea un registro en `direct_purchases`
- Por cada producto se crea un movimiento de inventario en `inventory_movements` con `movement_type='entry_direct'`, `quantity` positiva, `unit_cost = total_cost / quantity`
- El inventario del producto aumenta inmediatamente

### 8.5. Flujo: Cajera registra desposte

**Actor**: Empleado.

**Ruta**: `/empleado/desposte` (selección de lote) → `/empleado/desposte/[id]` (desposte en curso)

**Pasos**:
1. Pantalla inicial: lista de lotes activos con kg restantes. Seleccionar uno.
2. Ingresar peso total que entra al desposte (ej: 480 kg). Validar que no exceda el `kg_remaining` del lote.
3. Iniciar desposte → se crea registro en `despostes` con `status='in_progress'`.
4. Pantalla de desposte en curso muestra:
   - **Header**: lote seleccionado, peso entrada, peso registrado acumulado, peso restante (entrada - registrado), barra de progreso
   - **Lista de productos disponibles**: filtrar por `origin='from_processing'` y `category` coincidente con el tipo del lote (res → beef, cerdo → pork). Mostrar productos en tarjetas grandes con buscador.
   - **Cada producto registrado en este desposte**: lista debajo con producto, kg, botón para eliminar
5. La cajera selecciona un producto, ingresa los kg, confirma. Se agrega a la lista y el contador se actualiza.
6. Puede registrar tantos cortes como necesite. El contador puede llegar a 0 o quedar con algunos kg de diferencia (merma).
7. Botón "Finalizar desposte" siempre disponible. Al presionarlo:
   - Si la diferencia (merma calculada) es mayor al 10% del peso de entrada, mostrar advertencia: "La merma es de X kg (Y%) que parece alta. ¿Está seguro?" — solo advertencia, no bloquea.
   - Si no hay productos registrados, no permite finalizar.
   - Pide confirmación.
8. Al confirmar:
   - El desposte cambia a `status='finalized'`
   - Por cada `desposte_item` se crea un movimiento en `inventory_movements` con `movement_type='entry_desposte'`, `quantity` positiva igual al `weight_kg`, `unit_cost` = costo unitario calculado del lote (ver cálculo abajo)
   - Si la suma del peso de salida es menor al peso de entrada, la diferencia queda implícita como merma del desposte (no se crea movimiento por ella, no afecta inventario, solo queda registrada en la tabla `despostes`)

**Cálculo del `unit_cost` por corte desde un lote**:

Para reflejar la realidad del negocio (todos los cortes comparten el costo del lote), se usa el método más simple y honesto:

```
unit_cost_por_corte = total_cost_del_lote / total_kg_vendibles_estimados
```

Donde `total_kg_vendibles_estimados` es el `carcass_weight_kg` del lote (asumiendo que el negocio aprovecha casi todo). Esto significa que todos los cortes de un mismo lote tienen el mismo `unit_cost` registrado en los movimientos. La utilidad real se evalúa por lote completo en versiones futuras, no por corte individual.

### 8.6. Flujo: Ver inventario actual

**Vista admin** (`/admin/inventario`):
- Tabla con: producto | categoría | stock actual (kg o und) | costo unitario promedio ponderado | valor total
- Total general del valor del inventario (suma de todas las filas) destacado arriba
- Filtros: categoría, búsqueda por nombre
- Click en producto → detalle con historial de movimientos

**Vista empleado** (`/empleado/inventario`):
- Tabla con: producto | categoría | stock actual (kg o und)
- Sin columnas de costo ni valor
- Filtros: categoría, búsqueda por nombre

### 8.7. Flujo: Iniciar y completar conteo físico

**Actor**: Empleado inicia, admin puede ver en cualquier momento.

**Ruta empleado**: `/empleado/conteo` → `/empleado/conteo/[id]`

**Pasos**:
1. La cajera presiona "Iniciar nuevo conteo físico"
2. Se crea un registro en `physical_counts` con status='in_progress'
3. La app toma un snapshot del inventario teórico actual para cada producto activo y crea registros en `physical_count_items` con `theoretical_quantity` igual al stock actual y `physical_quantity` inicialmente vacío
4. Pantalla de conteo: lista todos los productos con su nombre, unidad, y un input para ingresar la cantidad física. **NO muestra el inventario teórico**. Esto evita que el empleado "ajuste" la cifra al teórico.
5. La cajera va llenando los campos. Puede guardar progreso e interrumpir.
6. Al terminar todos, botón "Finalizar conteo"
7. Confirma
8. El conteo pasa a `status='completed'`, se establece `completed_at`

**Vista admin**:
- Felix puede entrar a `/admin/conteos/[id]` en cualquier momento durante un conteo en curso y ver:
  - Para cada producto: teórico, físico (si ya fue contado), diferencia, %
  - Productos pendientes de contar
- Al terminar el conteo, la vista admin permite a Felix:
  - Aprobar las diferencias como merma natural (crea movimientos de `physical_count_adjustment` negativos por las diferencias)
  - Marcar productos para investigación (no genera movimiento, queda como nota)
- Si Felix aprueba ajustes, se crean los movimientos correspondientes y el inventario teórico se reconcilia con el físico.

### 8.8. Flujo: Gestión de catálogo (admin)

Felix puede:
- Agregar/editar/desactivar **proveedores** desde `/admin/proveedores`
- Agregar/editar/desactivar **productos** desde `/admin/productos`. Al crear un producto, indicar: nombre, categoría, unidad, origen (`from_processing` o `direct_purchase`), código POS opcional
- Crear nuevos **usuarios** desde `/admin/usuarios` (asigna email, contraseña inicial, nombre, rol). Esto se hace llamando al endpoint de Supabase Admin desde un Server Action seguro.

---

## 9. Reglas de negocio y validaciones

### 9.1. Generación de `lot_code`

- Formato: `{prefix}-{año}-{secuencia}`
- Prefijos: `RES` para res (cualquier tipo), `CER` para cerdo
- Secuencia: número entero de 3 dígitos con ceros a la izquierda, autoincremental por año y por prefijo, empezando en 001 cada año
- Implementar con una función SQL o secuencia. Garantizar atomicidad y unicidad.

### 9.2. Validaciones de formularios (zod schemas)

**Crear lote en pie**:
- `live_animal_count`: entero ≥ 1
- `live_weight_kg`: numérico > 0
- `live_purchase_cost`: numérico > 0
- Costos adicionales: numérico ≥ 0
- `live_purchase_date`: fecha válida, no futura

**Llegada de canales**:
- `carcass_count`: entero ≥ 1
- `carcass_weight_kg`: numérico > 0
- `arrival_date`: fecha válida, ≥ `live_purchase_date`, no futura

**Lote canal directo / cerdo**:
- `carcass_count`: entero ≥ 1
- `carcass_weight_kg`: numérico > 0
- `carcass_purchase_cost`: numérico > 0

**Compra directa**:
- `quantity`: numérico > 0
- `total_cost`: numérico > 0

**Desposte**:
- `input_weight_kg`: numérico > 0 y ≤ kg_remaining del lote seleccionado
- Para cada item: `weight_kg` > 0
- Al finalizar: al menos 1 item registrado

**Conteo físico**:
- Cada `physical_quantity` ≥ 0
- Todos los productos del snapshot deben tener `physical_quantity` antes de finalizar

### 9.3. Cálculos automáticos

- `unit_cost` por movimiento de desposte: ver fórmula en 8.5
- `total_cost` de lote: suma de costos según tipo
- `cost_per_kg_carcass`: total_cost / carcass_weight_kg
- `slaughter_yield_pct`: carcass_weight_kg / live_weight_kg (en %)
- `kg_remaining` de lote: carcass_weight_kg − suma de input_weight_kg de despostes finalizados
- `merma_kg` de desposte: input_weight_kg − suma de weight_kg de items
- Costo unitario promedio ponderado del inventario por producto: suma(quantity × unit_cost) / suma(quantity) considerando solo entradas

### 9.4. Cierre automático de lote

Cuando un desposte se finaliza, verificar si `kg_remaining` del lote es ≤ 0.5 kg (tolerancia para errores de balanza). Si lo es, cambiar status del lote a `closed` y establecer `closed_at`.

### 9.5. Inmutabilidad

- Los registros en `inventory_movements` nunca se modifican ni se borran
- Los despostes finalizados no se editan; las correcciones se hacen creando movimientos de ajuste
- Los conteos físicos completados no se editan
- Los lotes cerrados no se editan

---

## 10. Diseño visual (UI/UX)

### 10.1. Identidad visual

Carnegüey tiene un logo con un gallo, un cerdo y una res en silueta blanca sobre un círculo rojo, con tipografía roja sobre fondo blanco. El estilo de la app debe heredar esa identidad.

### 10.2. Paleta de colores

Definir como variables CSS de Tailwind:

```
--brand-red: #D40000      (rojo principal Carnegüey)
--brand-red-soft: #FFF0F0 (rojo claro para fondos suaves)
--brand-red-dark: #A00000 (rojo oscuro para hover)

--bg-primary: #FFFFFF
--bg-secondary: #F5F5F7
--bg-tertiary: #EBEBED

--text-primary: #1C1C1E
--text-secondary: #6E6E73
--text-tertiary: #AEAEB2

--border: rgba(0, 0, 0, 0.08)
--border-strong: rgba(0, 0, 0, 0.15)

--success: #34C759
--warning: #FF9500
--danger: #FF3B30
```

### 10.3. Tipografía

- Familia: SF Pro / system-ui stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Pesos: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Escala:
  - h1 (large title): 28px / 700
  - h2 (title): 22px / 700
  - h3 (subtitle): 17px / 600
  - body: 15px / 400
  - caption: 13px / 400
  - small: 11px / 500

### 10.4. Estilo general

Estilo iOS minimalista:
- Cards con `border-radius: 16px`, fondo blanco, sin sombra (o sombra muy sutil)
- Inputs con `border-radius: 12px`, fondo `#F5F5F7` o blanco
- Botones primarios con fondo rojo (`--brand-red`) y texto blanco, `border-radius: 14px`, padding generoso
- Botones secundarios con fondo blanco o `#F5F5F7`, texto rojo o gris
- Bottom tab bar fija en mobile con 3 secciones por rol (ver rutas)
- Header sticky superior con título grande estilo iOS al hacer scroll
- Padding lateral consistente: 16px en mobile, 24px en desktop
- Estados de carga con skeletons
- Toasts para confirmaciones y errores

### 10.5. Componentes clave

- **MetricCard**: card con label arriba (caption) y valor abajo (h2 o h1). Usado en dashboards.
- **ListItem**: fila con icono/badge a la izquierda, contenido principal centro, valor a la derecha. Para listas de lotes, productos, movimientos.
- **FormField**: label arriba (small uppercase + letterspacing), input abajo, mensaje de error en rojo.
- **Chip selector**: tipo "segmented control" iOS, para seleccionar entre opciones (ej: tipo de compra).
- **EmptyState**: cuando no hay datos, mostrar icono grande, texto explicativo y CTA.

### 10.6. Mobile vs desktop

- En mobile: tab bar inferior, navegación por pantallas completas
- En desktop: sidebar lateral izquierdo con navegación, contenido a la derecha con max-width 1200px
- Responsive breakpoint: 768px

### 10.7. Iconos

Usar lucide-react. Iconos sugeridos:
- Inicio: `LayoutDashboard`
- Inventario: `Package`
- Lotes: `Boxes`
- Desposte: `Scissors` o `Beef`
- Compras: `ShoppingCart`
- Conteo: `ClipboardCheck`
- Cifras: `BarChart3`
- Usuarios: `Users`
- Configuración: `Settings`
- Agregar: `Plus`
- Editar: `Pencil`
- Eliminar: `Trash2`
- Foto: `Camera` o `Image`

---

## 11. Estructura del proyecto

Ver sección 5.2.

Generar el proyecto con:
```bash
npx create-next-app@latest carneguey-os --typescript --tailwind --app --eslint
```

Configurar después:
- Instalar shadcn/ui: `npx shadcn@latest init`
- Componentes base: `npx shadcn@latest add button input form card dialog dropdown-menu select label textarea toast skeleton`
- Cliente Supabase: `npm install @supabase/supabase-js @supabase/ssr`
- Formularios: `npm install react-hook-form @hookform/resolvers zod`
- Fechas: `npm install date-fns`

---

## 12. Datos semilla (seed)

Crear un script de seed SQL (`supabase/seed.sql`) que pueble:

**Usuarios iniciales** (crear vía Supabase Auth + perfiles):
- 1 admin: email `felix@carneguey.com`, contraseña inicial provisional
- 2 employees: email `cajera1@carneguey.com`, `cajera2@carneguey.com`

**Proveedores ejemplo**:
- Don Hernán Pérez (live_cattle)
- Frigorífico La Esperanza (beef_carcass)
- Cerdos del Caribe (pork_carcass)
- Mac Pollo (poultry)
- Doña Luz Arepas (other)

**Productos base de res (origin='from_processing', category='beef')**:
- Lomo fino, Lomo ancho, Punta de anca, Sobrebarriga, Pierna, Cadera, Bola de pierna, Murillo, Posta, Falda, Pecho, Costilla con piel, Costilla gourmet sin piel, Carne de bisteck, Carne goulash, Cabeza de lomo, Bofe, Bofe salado, Asadura, Corazón, Hígado, Lengua, Hueso carnudo, Hueso de tuétano, Molida corriente, Sebo, Cola, Rabo

**Productos base de cerdo (origin='from_processing', category='pork')**:
- Lomo de cerdo, Pernil, Costilla de cerdo, Tocino, Papada, Espinazo, Cabeza de cerdo, Manitas, Pierna de cerdo, Brazuelo, Chicharrón, Molida de cerdo, Hueso de cerdo

**Productos base de pollo (origin='direct_purchase', category='poultry')**:
- Pechuga de pollo, Muslo, Contramuslo, Alas, Pollo entero, Molleja, Hígado de pollo, Gallina criolla

**Productos base otros (origin='direct_purchase', category='other')**:
- Arepa, Chorizo de cerdo, Chorizo de res, Queso costeño, Suero costeño, Butifarra

Catálogo final ajustable después por Felix desde el panel de admin. El POS code se deja vacío inicialmente y se llena cuando se cargue la lista oficial de eSyspos.

---

## 13. Variables de entorno

Archivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  (solo servidor, no exponer al cliente)
```

Documentar en `README.md` del proyecto.

---

## 14. Criterios de aceptación

La versión 1.0 se considera completa cuando:

1. **Autenticación**: un admin y un empleado pueden hacer login y son redirigidos a su panel respectivo. Las rutas cruzadas están bloqueadas.
2. **Creación de lote en pie**: Felix puede crear un lote tipo `beef_live` desde el celular. Aparece en estado pendiente para que la cajera registre la llegada.
3. **Llegada de canales**: la cajera puede ver el lote pendiente, registrar la llegada, y el lote pasa a activo.
4. **Lote canal directo y cerdo**: la cajera puede crear lotes activos directamente.
5. **Entrada directa**: la cajera puede registrar compras de pollo y otros productos, y el inventario aumenta inmediatamente.
6. **Desposte**: la cajera puede registrar un desposte parcial de un lote activo, agregar cortes uno por uno con contador en tiempo real, y finalizar. La merma se calcula automáticamente. Los cortes entran al inventario.
7. **Inventario admin**: Felix ve el inventario actual con cantidades, costos y valor total.
8. **Inventario empleado**: la cajera ve el inventario actual solo con cantidades, sin costos.
9. **Conteo físico**: la cajera puede iniciar un conteo, digitar cantidades físicas sin ver el teórico, y finalizar. Felix puede ver las diferencias y aprobarlas como ajustes.
10. **Comprobantes**: las fotos de recibos se suben a Supabase Storage y son visibles para admin.
11. **Catálogo**: Felix puede gestionar proveedores y productos.
12. **Seguridad**: las cajeras no pueden acceder a ningún dato monetario por ningún medio (URL directa, llamada API, etc.). RLS bloquea efectivamente.
13. **Despliegue**: la app está desplegada en Vercel, conectada a Supabase, accesible desde celular y desktop, instalable como PWA.

---

## 15. Notas finales para Claude Code

1. **Empieza creando el proyecto Next.js limpio**, configura Tailwind, Supabase, shadcn/ui.
2. **Define el esquema de base de datos completo en un archivo `supabase/migrations/001_initial_schema.sql`** antes de tocar el frontend. Verifica RLS y vistas restringidas.
3. **Construye los flujos en este orden**:
   1. Autenticación + roles + middleware
   2. Gestión de proveedores y productos (admin)
   3. Lote canal directo y cerdo (más simple)
   4. Entrada directa (pollo y otros)
   5. Lote en pie (admin) + llegada de canales (empleado)
   6. Desposte completo con contador en tiempo real
   7. Vista de inventario (ambos roles)
   8. Conteo físico
   9. Comprobantes (storage)
   10. Refinamiento visual, PWA, deploy
4. **No agregues funcionalidades fuera de alcance**. Si surge una duda, déjala documentada en un archivo `DECISIONS.md` para discusión posterior, pero no la implementes.
5. **Prioriza claridad sobre cleverness**. El código debe ser fácil de leer y modificar después.
6. **Usa Server Components donde sea posible**, Client Components solo donde se requiera interactividad.
7. **Server Actions para mutaciones** en lugar de API routes manuales, donde tenga sentido.
8. **Todos los textos visibles en español**. Los nombres de variables, funciones, tablas y columnas en inglés.
9. **Documenta en el README del proyecto** las decisiones clave y cómo correr el proyecto localmente.

---

**Fin de la especificación v1.0**
