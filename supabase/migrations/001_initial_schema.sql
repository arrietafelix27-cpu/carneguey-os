-- ============================================================================
-- Carnegüey OS · Migración inicial (001_initial_schema)
-- ----------------------------------------------------------------------------
-- Archivo estructurado en bloques. Migración completa, lista para ejecutar
-- de una sola vez en el SQL Editor de Supabase.
--
--   BLOQUE A · Tablas + CHECK constraints + índices
--   BLOQUE B · Secuencias y función gen_lot_code
--   BLOQUE C · Vistas calculadas
--   BLOQUE D · Vistas restringidas para empleado (sin dinero)
--   BLOQUE E · RLS + GRANTs por rol
--   BLOQUE F · Funciones SECURITY DEFINER de inventario
--   BLOQUE G · Trigger auth.users -> profiles
--   BLOQUE H · Bucket Storage 'receipts' + policies
--
-- Convenciones: toda tabla tiene id uuid PK y created_at timestamptz.
-- Pesos: numeric(10,2). Costos: numeric(12,2). Costo unitario: numeric(12,4).
--
-- Modelo de seguridad (resumen): Supabase usa un único rol de BD
-- (`authenticated`) para todos los usuarios; admin vs employee es de
-- aplicación (`profiles.role`). Por eso la separación NO se hace con GRANT
-- por rol (imposible distinguirlos a nivel BD) sino con RLS que llama a
-- `is_admin()`. Las tablas con dinero (purchase_lots, direct_purchases,
-- inventory_movements) solo dejan SELECT al admin vía RLS; las cajeras leen
-- esos datos a través de vistas `*_employee` que NO incluyen columnas
-- monetarias. Ver docs/DECISIONS.md D-007.
-- ============================================================================


-- ============================================================================
-- BLOQUE A · TABLAS + CHECK CONSTRAINTS + ÍNDICES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 · profiles — extiende auth.users con datos de perfil
-- ----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null check (role in ('admin', 'employee')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6.2 · providers — proveedores
-- ----------------------------------------------------------------------------
create table public.providers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  type        text not null check (
                type in ('live_cattle', 'beef_carcass', 'pork_carcass',
                         'poultry', 'other')),
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6.3 · products — catálogo maestro de productos / cortes
-- pos_code es UNIQUE pero nullable: Postgres permite múltiples NULL, así que
-- todo el catálogo semilla puede entrar con pos_code NULL sin colisionar.
-- ----------------------------------------------------------------------------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  pos_code    text unique,
  name        text not null,
  category    text not null check (category in ('beef', 'pork',
                                                'poultry', 'other')),
  unit        text not null check (unit in ('kg', 'unit')),
  origin      text not null check (origin in ('from_processing',
                                              'direct_purchase')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6.4 · purchase_lots — lotes de res (en pie o canal) y cerdo
-- Una sola tabla con columnas de los tres tipos. La integridad por tipo se
-- garantiza con CHECK constraints multi-condicionales (patrón
-- "type <> X OR (condiciones de X)"): si la fila no es de ese tipo el CHECK
-- pasa trivialmente; si lo es, exige los campos obligatorios de ese tipo.
-- status default 'active' (canales). Para beef_live el Server Action lo
-- crea explícitamente en 'pending_arrival' hasta que lleguen las canales.
-- Costos extra van NOT NULL DEFAULT 0 para que las sumas de costo no
-- necesiten COALESCE; los costos obligatorios por tipo van nullable + CHECK.
-- ----------------------------------------------------------------------------
create table public.purchase_lots (
  id                           uuid primary key default gen_random_uuid(),
  lot_code                     text unique not null,
  type                         text not null check (
                                 type in ('beef_live', 'beef_carcass',
                                          'pork_carcass')),
  provider_id                  uuid not null references public.providers(id),
  status                       text not null default 'active' check (
                                 status in ('pending_arrival', 'active',
                                            'closed')),

  -- beef_live (ganado en pie)
  live_animal_count            int,
  live_weight_kg               numeric(10,2),
  live_purchase_cost           numeric(12,2),
  transport_to_slaughter_cost  numeric(12,2) not null default 0,
  slaughter_cost               numeric(12,2) not null default 0,
  transport_to_shop_cost       numeric(12,2) not null default 0,
  other_costs                  numeric(12,2) not null default 0,
  live_purchase_date           date,

  -- beef_carcass / pork_carcass (canal directo)
  carcass_purchase_cost        numeric(12,2),
  carcass_transport_cost       numeric(12,2) not null default 0,

  -- llegada al negocio (todos los tipos)
  carcass_count                int,
  carcass_weight_kg            numeric(10,2),
  arrival_date                 date,

  -- metadatos
  notes                        text,
  created_by                   uuid not null references public.profiles(id),
  created_at                   timestamptz not null default now(),
  activated_by                 uuid references public.profiles(id),
  activated_at                 timestamptz,
  closed_at                    timestamptz,

  -- Integridad por tipo: ganado en pie requiere datos del animal vivo
  constraint chk_lot_beef_live check (
    type <> 'beef_live' or (
      live_animal_count is not null and live_animal_count >= 1
      and live_weight_kg is not null and live_weight_kg > 0
      and live_purchase_cost is not null and live_purchase_cost > 0
      and live_purchase_date is not null
    )
  ),

  -- Integridad por tipo: canal directo requiere el costo de compra del canal
  constraint chk_lot_carcass_direct check (
    type not in ('beef_carcass', 'pork_carcass') or (
      carcass_purchase_cost is not null and carcass_purchase_cost > 0
    )
  ),

  -- Cuando el lote ya llegó (active/closed) los datos de llegada son obligatorios
  constraint chk_lot_arrival check (
    status not in ('active', 'closed') or (
      carcass_count is not null and carcass_count >= 1
      and carcass_weight_kg is not null and carcass_weight_kg > 0
      and arrival_date is not null
    )
  ),

  -- Costos extra nunca negativos
  constraint chk_lot_costs_nonneg check (
    transport_to_slaughter_cost >= 0
    and slaughter_cost >= 0
    and transport_to_shop_cost >= 0
    and other_costs >= 0
    and carcass_transport_cost >= 0
  )
);

-- ----------------------------------------------------------------------------
-- 6.5 · direct_purchases — compras de pollo/otros que entran directo
-- ----------------------------------------------------------------------------
create table public.direct_purchases (
  id            uuid primary key default gen_random_uuid(),
  provider_id   uuid not null references public.providers(id),
  product_id    uuid not null references public.products(id),
  quantity      numeric(10,2) not null check (quantity > 0),
  total_cost    numeric(12,2) not null check (total_cost > 0),
  purchase_date date not null,
  notes         text,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6.6 · despostes — despostes parciales de un lote
-- ----------------------------------------------------------------------------
create table public.despostes (
  id              uuid primary key default gen_random_uuid(),
  lot_id          uuid not null references public.purchase_lots(id),
  input_weight_kg numeric(10,2) not null check (input_weight_kg > 0),
  status          text not null default 'in_progress' check (
                    status in ('in_progress', 'finalized')),
  desposte_date   date not null default current_date,
  notes           text,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now(),
  finalized_at    timestamptz
);

-- ----------------------------------------------------------------------------
-- 6.7 · desposte_items — cortes que salen de un desposte
-- La regla "solo productos origin='from_processing' y categoría coincidente
-- con el lote" no es expresable como CHECK (cruza tablas); se valida en la
-- función SECURITY DEFINER del Bloque F y en la UI.
-- ----------------------------------------------------------------------------
create table public.desposte_items (
  id           uuid primary key default gen_random_uuid(),
  desposte_id  uuid not null references public.despostes(id),
  product_id   uuid not null references public.products(id),
  weight_kg    numeric(10,2) not null check (weight_kg > 0),
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6.8 · inventory_movements — registro inmutable, source-of-truth
-- quantity: positivo = entrada, negativo = salida. No puede ser cero.
-- La inmutabilidad (no update/delete) se refuerza con RLS en el Bloque E.
-- ----------------------------------------------------------------------------
create table public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id),
  movement_type   text not null check (
                    movement_type in ('entry_direct', 'entry_desposte',
                                      'adjustment_in', 'adjustment_out',
                                      'physical_count_adjustment')),
  quantity        numeric(10,2) not null check (quantity <> 0),
  unit_cost       numeric(12,4) not null check (unit_cost >= 0),
  reference_type  text check (
                    reference_type in ('direct_purchase', 'desposte_item',
                                       'adjustment', 'physical_count')),
  reference_id    uuid,
  notes           text,
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6.9 · physical_counts — conteos físicos
-- ----------------------------------------------------------------------------
create table public.physical_counts (
  id            uuid primary key default gen_random_uuid(),
  count_date    date not null default current_date,
  status        text not null default 'in_progress' check (
                  status in ('in_progress', 'completed')),
  notes         text,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

-- ----------------------------------------------------------------------------
-- 6.10 · physical_count_items — cada producto contado
-- physical_quantity es NULLABLE (no NOT NULL como dice §6.10 literal):
-- el flujo §8.7 crea los items con cantidad física vacía y la cajera los
-- llena progresivamente; §9.2 exige que estén todos llenos solo al finalizar.
-- La validación "todos llenos" se hace en la función de cierre (Bloque F).
-- Decisión registrada en docs/DECISIONS.md (D-005).
-- ----------------------------------------------------------------------------
create table public.physical_count_items (
  id                    uuid primary key default gen_random_uuid(),
  physical_count_id     uuid not null references public.physical_counts(id),
  product_id            uuid not null references public.products(id),
  theoretical_quantity  numeric(10,2) not null,
  physical_quantity     numeric(10,2) check (
                          physical_quantity is null or physical_quantity >= 0),
  notes                 text,
  created_at            timestamptz not null default now(),
  unique (physical_count_id, product_id)
);

-- ----------------------------------------------------------------------------
-- 6.11 · receipts — fotos de comprobantes
-- ----------------------------------------------------------------------------
create table public.receipts (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (
                 entity_type in ('purchase_lot', 'direct_purchase')),
  entity_id    uuid not null,
  file_path    text not null,
  uploaded_by  uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Índices — FKs y columnas de filtrado frecuente
-- ----------------------------------------------------------------------------
create index idx_purchase_lots_provider     on public.purchase_lots(provider_id);
create index idx_purchase_lots_status       on public.purchase_lots(status);
create index idx_purchase_lots_type         on public.purchase_lots(type);
create index idx_direct_purchases_provider  on public.direct_purchases(provider_id);
create index idx_direct_purchases_product   on public.direct_purchases(product_id);
create index idx_despostes_lot              on public.despostes(lot_id);
create index idx_despostes_status           on public.despostes(status);
create index idx_desposte_items_desposte    on public.desposte_items(desposte_id);
create index idx_desposte_items_product     on public.desposte_items(product_id);
create index idx_inv_mov_product            on public.inventory_movements(product_id);
create index idx_inv_mov_type               on public.inventory_movements(movement_type);
create index idx_inv_mov_reference          on public.inventory_movements(reference_type, reference_id);
create index idx_pc_items_count             on public.physical_count_items(physical_count_id);
create index idx_pc_items_product           on public.physical_count_items(product_id);
create index idx_receipts_entity            on public.receipts(entity_type, entity_id);
create index idx_products_category          on public.products(category);
create index idx_products_origin            on public.products(origin);

-- ============================================================================
-- FIN BLOQUE A
-- ============================================================================


-- ============================================================================
-- BLOQUE B · SECUENCIAS Y FUNCIÓN gen_lot_code
-- ----------------------------------------------------------------------------
-- Spec §9.1: lot_code = {prefijo}-{año}-{secuencia 3 dígitos}.
--   prefijo: RES para res (beef_live y beef_carcass), CER para cerdo
--            (pork_carcass).
--   secuencia: autoincremental por año Y por prefijo, reinicia en 001 cada
--              año, con ceros a la izquierda (001, 002, ...).
--
-- Implementación: tabla contador (prefix, year) -> last_seq + función con
-- UPSERT atómico. No se usan secuencias nativas de Postgres porque estas no
-- se reinician por año ni se particionan por prefijo sin DDL dinámico.
-- El UPSERT toma lock de fila, garantizando atomicidad y unicidad bajo
-- concurrencia (dos cajeras creando lotes a la vez). El reinicio anual es
-- natural: un año nuevo es una fila nueva que arranca en 1.
--
-- Esta tabla es interna (no está en el modelo §6). Su acceso se bloquea con
-- RLS sin policies en el Bloque E; solo la función SECURITY DEFINER la toca.
-- ============================================================================

create table public.lot_code_counters (
  prefix     text not null check (prefix in ('RES', 'CER')),
  year       int  not null,
  last_seq   int  not null default 0,
  primary key (prefix, year)
);

-- ----------------------------------------------------------------------------
-- gen_lot_code(p_type) -> 'RES-2026-001'
-- SECURITY DEFINER: corre con privilegios del owner para poder escribir el
-- contador aunque el llamador (cajera) tenga RLS restrictiva. search_path
-- fijado a public para evitar secuestro de search_path.
-- El año se calcula en zona America/Bogota: la secuencia anual rota a la
-- medianoche colombiana, no a la UTC.
-- ----------------------------------------------------------------------------
create or replace function public.gen_lot_code(p_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_year   int := extract(year from (now() at time zone 'America/Bogota'))::int;
  v_seq    int;
begin
  v_prefix := case
    when p_type in ('beef_live', 'beef_carcass') then 'RES'
    when p_type = 'pork_carcass'                 then 'CER'
    else null
  end;

  if v_prefix is null then
    raise exception 'Tipo de lote inválido para generar lot_code: %', p_type;
  end if;

  insert into public.lot_code_counters (prefix, year, last_seq)
  values (v_prefix, v_year, 1)
  on conflict (prefix, year)
  do update set last_seq = lot_code_counters.last_seq + 1
  returning last_seq into v_seq;

  return v_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- ----------------------------------------------------------------------------
-- Trigger BEFORE INSERT: si el lote entra sin lot_code, se genera aquí.
-- Corre antes de la verificación de constraints, así que satisface el
-- NOT NULL / UNIQUE de purchase_lots.lot_code sin que el Server Action tenga
-- que calcularlo (defensa en profundidad: aunque la app lo olvide, queda).
-- ----------------------------------------------------------------------------
create or replace function public.set_lot_code()
returns trigger
language plpgsql
as $$
begin
  if new.lot_code is null or new.lot_code = '' then
    new.lot_code := public.gen_lot_code(new.type);
  end if;
  return new;
end;
$$;

create trigger trg_set_lot_code
  before insert on public.purchase_lots
  for each row
  execute function public.set_lot_code();

-- ============================================================================
-- FIN BLOQUE B
-- ============================================================================


-- ============================================================================
-- BLOQUE C · VISTAS CALCULADAS (spec §6.12)
-- ----------------------------------------------------------------------------
-- Las 3 vistas se crean con `security_invoker = on` (Postgres 15+, Supabase
-- lo soporta): la vista respeta la RLS del usuario que consulta sobre las
-- tablas base, en vez de correr como owner. Esto es la base del modelo de
-- seguridad — el ocultamiento de columnas monetarias para el rol employee
-- se hace en el Bloque D (vistas *_employee sin columnas de costo) + los
-- GRANT del Bloque E. Estas vistas SÍ exponen dinero y solo el admin podrá
-- consultarlas (GRANT en Bloque E).
--
-- Todos los números se redondean explícitamente (regla del CLAUDE.md: sin
-- decimales inesperados en pantalla). Divisiones protegidas con NULLIF.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- v_current_inventory — inventario teórico por producto (spec §8.6 admin)
-- quantity_in_stock = suma de todos los movimientos (entradas + / salidas -).
-- weighted_avg_unit_cost = Σ(qty·unit_cost) / Σ(qty), SOLO entradas (§9.3).
-- total_value = quantity_in_stock · weighted_avg_unit_cost.
-- LEFT JOIN: productos sin movimientos aparecen con stock/costo/valor en 0.
-- ----------------------------------------------------------------------------
create view public.v_current_inventory
with (security_invoker = on) as
with agg as (
  select
    p.id        as product_id,
    p.name      as product_name,
    p.category,
    p.unit,
    p.active,
    coalesce(sum(m.quantity), 0) as quantity_in_stock,
    coalesce(
      sum(case when m.quantity > 0 then m.quantity * m.unit_cost end)
        / nullif(sum(case when m.quantity > 0 then m.quantity end), 0),
      0
    ) as weighted_avg_unit_cost
  from public.products p
  left join public.inventory_movements m on m.product_id = p.id
  group by p.id
)
select
  product_id,
  product_name,
  category,
  unit,
  active,
  round(quantity_in_stock, 2)::numeric(12,2)                        as quantity_in_stock,
  round(weighted_avg_unit_cost, 4)::numeric(12,4)                   as weighted_avg_unit_cost,
  round(quantity_in_stock * weighted_avg_unit_cost, 2)::numeric(14,2) as total_value
from agg;

-- ----------------------------------------------------------------------------
-- v_lot_summary — resumen por lote (spec §6.4 campos calculados + §6.12)
-- total_cost por tipo; cost_per_kg_carcass; slaughter_yield_pct (solo
-- beef_live); kg_despostado y kg_remaining contra despostes FINALIZADOS;
-- conteo de despostes finalizados.
-- ----------------------------------------------------------------------------
create view public.v_lot_summary
with (security_invoker = on) as
with d as (
  select
    lot_id,
    count(*) filter (where status = 'finalized')                        as finalized_desposte_count,
    coalesce(sum(input_weight_kg) filter (where status = 'finalized'), 0) as kg_despostado
  from public.despostes
  group by lot_id
),
base as (
  select
    l.*,
    case
      when l.type = 'beef_live' then
        coalesce(l.live_purchase_cost, 0)
        + l.transport_to_slaughter_cost
        + l.slaughter_cost
        + l.transport_to_shop_cost
        + l.other_costs
      when l.type in ('beef_carcass', 'pork_carcass') then
        coalesce(l.carcass_purchase_cost, 0)
        + l.carcass_transport_cost
      else 0
    end as total_cost
  from public.purchase_lots l
)
select
  b.id                as lot_id,
  b.lot_code,
  b.type,
  b.status,
  b.provider_id,
  b.live_weight_kg,
  b.carcass_weight_kg,
  b.carcass_count,
  b.arrival_date,
  b.created_at,
  round(b.total_cost, 2)::numeric(14,2)                                  as total_cost,
  round(b.total_cost / nullif(b.carcass_weight_kg, 0), 4)::numeric(12,4)  as cost_per_kg_carcass,
  case when b.type = 'beef_live'
       then round(b.carcass_weight_kg / nullif(b.live_weight_kg, 0) * 100, 2)::numeric(6,2)
  end                                                                    as slaughter_yield_pct,
  coalesce(d.kg_despostado, 0)::numeric(12,2)                            as kg_despostado,
  round(coalesce(b.carcass_weight_kg, 0) - coalesce(d.kg_despostado, 0), 2)::numeric(12,2) as kg_remaining,
  coalesce(d.finalized_desposte_count, 0)                                as finalized_desposte_count
from base b
left join d on d.lot_id = b.id;

-- ----------------------------------------------------------------------------
-- v_desposte_summary — resumen por desposte (spec §6.6 campos calculados)
-- merma = peso entrada − Σ peso de cortes. Definitiva solo si finalized,
-- pero se calcula siempre (la UI usa el dato en curso para el contador).
-- Esta vista NO expone dinero (solo pesos) — segura para ambos roles, pero
-- igual con security_invoker por consistencia.
-- ----------------------------------------------------------------------------
create view public.v_desposte_summary
with (security_invoker = on) as
select
  d.id              as desposte_id,
  d.lot_id,
  d.status,
  d.desposte_date,
  d.input_weight_kg,
  d.created_at,
  d.finalized_at,
  coalesce(sum(i.weight_kg), 0)::numeric(12,2)                              as total_output_kg,
  round(d.input_weight_kg - coalesce(sum(i.weight_kg), 0), 2)::numeric(12,2) as merma_kg,
  round(
    (d.input_weight_kg - coalesce(sum(i.weight_kg), 0))
      / nullif(d.input_weight_kg, 0) * 100, 2
  )::numeric(6,2)                                                           as merma_pct,
  count(i.id)                                                               as item_count
from public.despostes d
left join public.desposte_items i on i.desposte_id = d.id
group by d.id;

-- ============================================================================
-- FIN BLOQUE C
-- ============================================================================


-- ============================================================================
-- BLOQUE D · VISTAS RESTRINGIDAS PARA EMPLEADO (sin columnas monetarias)
-- ----------------------------------------------------------------------------
-- Estas vistas se crean SIN security_invoker (corren como owner = postgres,
-- que tiene BYPASSRLS). Así las cajeras obtienen filas aunque la RLS de las
-- tablas base les niegue SELECT directo. Son seguras porque NO exponen
-- ninguna columna de dinero. Es el mecanismo de la spec §7.4: "vista que
-- excluye costos + permisos solo sobre la vista". Ver DECISIONS.md D-007.
-- ============================================================================

-- Lotes sin ninguna columna de costo (spec §8.2: la cajera ve proveedor,
-- número de animales esperado, fecha — nunca dinero).
create view public.v_purchase_lots_employee as
select
  id, lot_code, type, provider_id, status,
  live_animal_count, live_weight_kg, live_purchase_date,
  carcass_count, carcass_weight_kg, arrival_date,
  notes, created_by, created_at, activated_by, activated_at, closed_at
from public.purchase_lots;

-- Compras directas sin total_cost.
create view public.v_direct_purchases_employee as
select
  id, provider_id, product_id, quantity, purchase_date,
  notes, created_by, created_at
from public.direct_purchases;

-- Movimientos de inventario sin unit_cost.
create view public.v_inventory_movements_employee as
select
  id, product_id, movement_type, quantity,
  reference_type, reference_id, notes, created_by, created_at
from public.inventory_movements;

-- Inventario actual solo con cantidades (spec §8.6 vista empleado).
-- Se calcula directo de las tablas base (no sobre v_current_inventory) para
-- no arrastrar columnas de dinero ni depender de su RLS.
create view public.v_current_inventory_employee as
select
  p.id        as product_id,
  p.name      as product_name,
  p.category,
  p.unit,
  p.active,
  coalesce(sum(m.quantity), 0)::numeric(12,2) as quantity_in_stock
from public.products p
left join public.inventory_movements m on m.product_id = p.id
group by p.id;

-- Items de conteo físico SIN theoretical_quantity (anti-fraude, spec §8.7:
-- la cajera no debe ver el teórico durante el conteo para no "ajustar" la
-- cifra). Ver DECISIONS.md D-008.
create view public.v_physical_count_items_employee as
select
  i.id, i.physical_count_id, i.product_id,
  p.name as product_name, p.category, p.unit,
  i.physical_quantity, i.notes, i.created_at
from public.physical_count_items i
join public.products p on p.id = i.product_id;

-- Resultado del conteo CON teórico, físico y diferencias — SOLO admin.
-- Vista definer (corre como owner) con filtro `where is_admin()`: solo
-- devuelve filas si quien consulta es admin. Es la pantalla §8.7 de Félix.
create view public.v_physical_count_items_admin as
select
  i.id,
  i.physical_count_id,
  i.product_id,
  p.name     as product_name,
  p.category,
  p.unit,
  i.theoretical_quantity,
  i.physical_quantity,
  round(coalesce(i.physical_quantity, 0) - i.theoretical_quantity, 2)::numeric(12,2)
    as difference,
  round(
    (coalesce(i.physical_quantity, 0) - i.theoretical_quantity)
      / nullif(i.theoretical_quantity, 0) * 100, 2
  )::numeric(8,2) as difference_pct,
  i.notes,
  i.created_at
from public.physical_count_items i
join public.products p on p.id = i.product_id
where public.is_admin();

-- ============================================================================
-- FIN BLOQUE D
-- ============================================================================


-- ============================================================================
-- BLOQUE E · RLS + GRANTs POR ROL
-- ----------------------------------------------------------------------------
-- is_admin(): SECURITY DEFINER, corre como owner (BYPASSRLS) por lo que
-- consultar profiles aquí NO dispara recursión de RLS. Es la pieza central
-- del control admin vs employee.
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active = true
  );
$$;

-- ---- Habilitar RLS en TODAS las tablas (sin excepción) --------------------
alter table public.profiles              enable row level security;
alter table public.providers             enable row level security;
alter table public.products              enable row level security;
alter table public.purchase_lots         enable row level security;
alter table public.direct_purchases      enable row level security;
alter table public.despostes             enable row level security;
alter table public.desposte_items        enable row level security;
alter table public.inventory_movements   enable row level security;
alter table public.physical_counts       enable row level security;
alter table public.physical_count_items  enable row level security;
alter table public.receipts              enable row level security;
alter table public.lot_code_counters     enable row level security;
-- lot_code_counters queda con RLS y SIN policies => acceso directo negado a
-- todos; solo la función gen_lot_code (SECURITY DEFINER) lo toca.

-- ---- profiles -------------------------------------------------------------
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles
  for insert with check (public.is_admin());
create policy profiles_update on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- ---- providers / products : lectura todos, escritura solo admin ----------
create policy providers_select on public.providers
  for select using (public.is_active_user());
create policy providers_write on public.providers
  for all using (public.is_admin()) with check (public.is_admin());

create policy products_select on public.products
  for select using (public.is_active_user());
create policy products_write on public.products
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- purchase_lots : tabla base con dinero => SELECT solo admin ----------
-- Las cajeras leen vía v_purchase_lots_employee.
create policy lots_select_admin on public.purchase_lots
  for select using (public.is_admin());

-- INSERT: admin cualquier tipo; empleado solo canal directo / cerdo.
create policy lots_insert on public.purchase_lots
  for insert with check (
    created_by = auth.uid()
    and (
      public.is_admin()
      or (public.is_active_user()
          and type in ('beef_carcass', 'pork_carcass'))
    )
  );

-- UPDATE: admin todo; empleado solo registrar llegada de un beef_live
-- pendiente (pasa pending_arrival -> active).
create policy lots_update on public.purchase_lots
  for update using (
    public.is_admin()
    or (public.is_active_user()
        and type = 'beef_live'
        and status = 'pending_arrival')
  ) with check (
    public.is_admin()
    or (public.is_active_user()
        and type = 'beef_live'
        and status in ('pending_arrival', 'active'))
  );

-- ---- direct_purchases : dinero => SELECT solo admin; INSERT ambos --------
create policy dp_select_admin on public.direct_purchases
  for select using (public.is_admin());
create policy dp_insert on public.direct_purchases
  for insert with check (created_by = auth.uid() and public.is_active_user());

-- ---- despostes : sin dinero, ambos roles ---------------------------------
create policy desp_select on public.despostes
  for select using (public.is_active_user());
create policy desp_insert on public.despostes
  for insert with check (created_by = auth.uid() and public.is_active_user());
create policy desp_update on public.despostes
  for update using (public.is_active_user() and status = 'in_progress')
  with check (public.is_active_user());
create policy desp_delete on public.despostes
  for delete using (public.is_active_user() and status = 'in_progress');

-- ---- desposte_items : editable solo mientras el desposte está en curso ---
create policy di_select on public.desposte_items
  for select using (public.is_active_user());
create policy di_insert on public.desposte_items
  for insert with check (
    public.is_active_user()
    and exists (select 1 from public.despostes d
                where d.id = desposte_id and d.status = 'in_progress')
  );
create policy di_delete on public.desposte_items
  for delete using (
    public.is_active_user()
    and exists (select 1 from public.despostes d
                where d.id = desposte_id and d.status = 'in_progress')
  );

-- ---- inventory_movements : dinero + inmutable ---------------------------
-- SELECT solo admin (cajeras usan v_inventory_movements_employee).
-- Sin policies de INSERT/UPDATE/DELETE => nadie escribe directo; solo las
-- funciones SECURITY DEFINER del Bloque F.
create policy im_select_admin on public.inventory_movements
  for select using (public.is_admin());

-- ---- physical_counts : sin dinero, ambos roles ---------------------------
create policy pc_select on public.physical_counts
  for select using (public.is_active_user());
create policy pc_insert on public.physical_counts
  for insert with check (created_by = auth.uid() and public.is_active_user());
create policy pc_update on public.physical_counts
  for update using (public.is_active_user() and status = 'in_progress')
  with check (public.is_active_user());
create policy pc_delete on public.physical_counts
  for delete using (public.is_active_user() and status = 'in_progress');

-- ---- physical_count_items ------------------------------------------------
-- SELECT directo solo admin O cuando el conteo ya está completado (post-hoc
-- el teórico ya no se puede manipular). Durante el conteo la cajera lee vía
-- v_physical_count_items_employee (sin theoretical_quantity). D-008.
create policy pci_select on public.physical_count_items
  for select using (
    public.is_admin()
    or exists (select 1 from public.physical_counts c
               where c.id = physical_count_id and c.status = 'completed')
  );
-- UPDATE: la cajera digita physical_quantity mientras el conteo está en
-- curso. El GRANT a nivel columna (más abajo) evita que pueda leer/escribir
-- theoretical_quantity.
create policy pci_update on public.physical_count_items
  for update using (
    public.is_active_user()
    and exists (select 1 from public.physical_counts c
                where c.id = physical_count_id and c.status = 'in_progress')
  ) with check (
    public.is_active_user()
    and exists (select 1 from public.physical_counts c
                where c.id = physical_count_id and c.status = 'in_progress')
  );
-- INSERT (snapshot del teórico) lo hace la función fn_start_physical_count
-- (SECURITY DEFINER). Sin policy de INSERT => nadie inserta directo.

-- ---- receipts : ambos roles leen y suben ---------------------------------
create policy rc_select on public.receipts
  for select using (public.is_active_user());
create policy rc_insert on public.receipts
  for insert with check (uploaded_by = auth.uid() and public.is_active_user());

-- ---- GRANTs --------------------------------------------------------------
-- anon (no autenticado) no toca nada: la app exige login.
revoke all on all tables in schema public from anon;

-- authenticated: privilegios de tabla; la RLS de arriba filtra filas.
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles              to authenticated;
grant select, insert, update, delete on public.providers             to authenticated;
grant select, insert, update, delete on public.products              to authenticated;
grant select, insert, update         on public.purchase_lots         to authenticated;
grant select, insert                 on public.direct_purchases      to authenticated;
grant select, insert, update, delete on public.despostes             to authenticated;
grant select, insert, delete         on public.desposte_items        to authenticated;
grant select                         on public.inventory_movements   to authenticated;
grant select, insert, update, delete on public.physical_counts       to authenticated;
-- physical_count_items: SELECT/UPDATE solo de columnas no sensibles.
grant select (id, physical_count_id, product_id, physical_quantity,
              notes, created_at)              on public.physical_count_items to authenticated;
grant update (physical_quantity, notes)       on public.physical_count_items to authenticated;
grant select, insert                          on public.receipts            to authenticated;

-- Vistas: SELECT a authenticated. Las *_employee no tienen dinero. Las
-- calculadas con dinero (v_current_inventory, v_lot_summary) son
-- security_invoker => la RLS de las tablas base deja pasar solo al admin.
grant select on public.v_current_inventory           to authenticated;
grant select on public.v_lot_summary                 to authenticated;
grant select on public.v_desposte_summary            to authenticated;
grant select on public.v_purchase_lots_employee      to authenticated;
grant select on public.v_direct_purchases_employee   to authenticated;
grant select on public.v_inventory_movements_employee to authenticated;
grant select on public.v_current_inventory_employee  to authenticated;
grant select on public.v_physical_count_items_employee to authenticated;
grant select on public.v_physical_count_items_admin    to authenticated;

-- ============================================================================
-- FIN BLOQUE E
-- ============================================================================


-- ============================================================================
-- BLOQUE F · FUNCIONES SECURITY DEFINER DE INVENTARIO
-- ----------------------------------------------------------------------------
-- Únicos caminos de escritura a inventory_movements. Corren como owner
-- (bypass RLS) pero auth.uid() sigue siendo el del usuario que llama, así
-- la bitácora (created_by) es correcta. Los Server Actions las invocan por
-- RPC. El cálculo del costo NUNCA sale al cliente (DECISIONS.md D-003/D-004).
-- ============================================================================

-- helper interno: costo total de un lote según su tipo
create or replace function public._lot_total_cost(p_lot public.purchase_lots)
returns numeric
language sql
immutable
as $$
  select case
    when p_lot.type = 'beef_live' then
      coalesce(p_lot.live_purchase_cost, 0)
      + p_lot.transport_to_slaughter_cost
      + p_lot.slaughter_cost
      + p_lot.transport_to_shop_cost
      + p_lot.other_costs
    when p_lot.type in ('beef_carcass', 'pork_carcass') then
      coalesce(p_lot.carcass_purchase_cost, 0)
      + p_lot.carcass_transport_cost
    else 0
  end;
$$;

-- helper interno: categoría de producto que corresponde a un tipo de lote
create or replace function public._lot_category(p_type text)
returns text
language sql
immutable
as $$
  select case
    when p_type in ('beef_live', 'beef_carcass') then 'beef'
    when p_type = 'pork_carcass'                 then 'pork'
    else null
  end;
$$;

-- ---- Crear lote de ganado en pie (solo admin) ----------------------------
create or replace function public.fn_create_lot_live(
  p_provider_id                 uuid,
  p_live_animal_count           int,
  p_live_weight_kg              numeric,
  p_live_purchase_cost          numeric,
  p_transport_to_slaughter_cost numeric default 0,
  p_slaughter_cost              numeric default 0,
  p_transport_to_shop_cost      numeric default 0,
  p_other_costs                 numeric default 0,
  p_live_purchase_date          date    default current_date,
  p_notes                       text    default null
)
returns table (lot_id uuid, lot_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id   uuid;
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede crear lotes de ganado en pie';
  end if;

  insert into public.purchase_lots (
    type, provider_id, status,
    live_animal_count, live_weight_kg, live_purchase_cost,
    transport_to_slaughter_cost, slaughter_cost,
    transport_to_shop_cost, other_costs, live_purchase_date,
    notes, created_by
  ) values (
    'beef_live', p_provider_id, 'pending_arrival',
    p_live_animal_count, p_live_weight_kg, p_live_purchase_cost,
    coalesce(p_transport_to_slaughter_cost, 0),
    coalesce(p_slaughter_cost, 0),
    coalesce(p_transport_to_shop_cost, 0),
    coalesce(p_other_costs, 0),
    p_live_purchase_date, p_notes, auth.uid()
  )
  returning id, lot_code into v_id, v_code;

  return query select v_id, v_code;
end;
$$;

-- ---- Crear lote de canal directo (res) o cerdo (admin o empleado) --------
create or replace function public.fn_create_lot_carcass(
  p_type                  text,
  p_provider_id           uuid,
  p_carcass_count         int,
  p_carcass_weight_kg     numeric,
  p_carcass_purchase_cost numeric,
  p_carcass_transport_cost numeric default 0,
  p_arrival_date          date    default current_date,
  p_notes                 text    default null
)
returns table (lot_id uuid, lot_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id   uuid;
  v_code text;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_type not in ('beef_carcass', 'pork_carcass') then
    raise exception 'Tipo inválido para canal directo: %', p_type;
  end if;

  insert into public.purchase_lots (
    type, provider_id, status,
    carcass_purchase_cost, carcass_transport_cost,
    carcass_count, carcass_weight_kg, arrival_date,
    notes, created_by
  ) values (
    p_type, p_provider_id, 'active',
    p_carcass_purchase_cost, coalesce(p_carcass_transport_cost, 0),
    p_carcass_count, p_carcass_weight_kg, p_arrival_date,
    p_notes, auth.uid()
  )
  returning id, lot_code into v_id, v_code;

  return query select v_id, v_code;
end;
$$;

-- ---- Registrar llegada de canales de un lote en pie pendiente ------------
create or replace function public.fn_register_lot_arrival(
  p_lot_id            uuid,
  p_carcass_count     int,
  p_carcass_weight_kg numeric,
  p_arrival_date      date,
  p_notes             text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot public.purchase_lots;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_lot from public.purchase_lots where id = p_lot_id for update;
  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if v_lot.type <> 'beef_live' or v_lot.status <> 'pending_arrival' then
    raise exception 'El lote no está pendiente de llegada';
  end if;

  update public.purchase_lots
     set carcass_count   = p_carcass_count,
         carcass_weight_kg = p_carcass_weight_kg,
         arrival_date    = p_arrival_date,
         status          = 'active',
         activated_by    = auth.uid(),
         activated_at    = now(),
         notes           = coalesce(p_notes, notes)
   where id = p_lot_id;
end;
$$;

-- ---- Registrar compra directa (pollo/otros) — varios productos por recibo
-- p_items: jsonb [{ "product_id": uuid, "quantity": num, "total_cost": num }]
create or replace function public.fn_register_direct_purchase(
  p_provider_id  uuid,
  p_purchase_date date,
  p_items        jsonb,
  p_notes        text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item       jsonb;
  v_product_id uuid;
  v_qty        numeric;
  v_total      numeric;
  v_dp_id      uuid;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay productos en la compra';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty        := (v_item->>'quantity')::numeric;
    v_total      := (v_item->>'total_cost')::numeric;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Cantidad inválida para producto %', v_product_id;
    end if;
    if v_total is null or v_total <= 0 then
      raise exception 'Costo inválido para producto %', v_product_id;
    end if;

    insert into public.direct_purchases (
      provider_id, product_id, quantity, total_cost,
      purchase_date, notes, created_by
    ) values (
      p_provider_id, v_product_id, v_qty, v_total,
      p_purchase_date, p_notes, auth.uid()
    )
    returning id into v_dp_id;

    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, created_by
    ) values (
      v_product_id, 'entry_direct', v_qty,
      round(v_total / v_qty, 4),
      'direct_purchase', v_dp_id, auth.uid()
    );
  end loop;
end;
$$;

-- ---- Iniciar desposte de un lote activo ----------------------------------
create or replace function public.fn_start_desposte(
  p_lot_id          uuid,
  p_input_weight_kg numeric,
  p_desposte_date   date default current_date,
  p_notes           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot        public.purchase_lots;
  v_despostado numeric;
  v_remaining  numeric;
  v_id         uuid;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_lot from public.purchase_lots where id = p_lot_id;
  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if v_lot.status <> 'active' then
    raise exception 'El lote no está activo para desposte';
  end if;

  select coalesce(sum(input_weight_kg), 0) into v_despostado
  from public.despostes
  where lot_id = p_lot_id and status = 'finalized';

  v_remaining := coalesce(v_lot.carcass_weight_kg, 0) - v_despostado;
  if p_input_weight_kg <= 0 then
    raise exception 'El peso de entrada debe ser mayor a 0';
  end if;
  if p_input_weight_kg > v_remaining then
    raise exception 'El peso (% kg) excede el disponible del lote (% kg)',
      p_input_weight_kg, v_remaining;
  end if;

  insert into public.despostes (
    lot_id, input_weight_kg, status, desposte_date, notes, created_by
  ) values (
    p_lot_id, p_input_weight_kg, 'in_progress',
    coalesce(p_desposte_date, current_date), p_notes, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---- Validar cortes: origin from_processing + categoría del lote ---------
-- SECURITY DEFINER: necesita leer purchase_lots, cuya RLS niega SELECT a las
-- cajeras. Sin definer la validación de categoría se saltaría en silencio.
create or replace function public._check_desposte_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot_type  text;
  v_prod      public.products;
begin
  select pl.type into v_lot_type
  from public.despostes d
  join public.purchase_lots pl on pl.id = d.lot_id
  where d.id = new.desposte_id;

  select * into v_prod from public.products where id = new.product_id;
  if not found then
    raise exception 'Producto no encontrado';
  end if;
  if v_prod.origin <> 'from_processing' then
    raise exception 'El producto % no sale de desposte', v_prod.name;
  end if;
  if v_prod.category <> public._lot_category(v_lot_type) then
    raise exception 'El producto % no corresponde a la categoría del lote',
      v_prod.name;
  end if;
  return new;
end;
$$;

create trigger trg_check_desposte_item
  before insert on public.desposte_items
  for each row execute function public._check_desposte_item();

-- ---- Finalizar desposte: genera movimientos y cierra lote si se agota ----
create or replace function public.fn_finalize_desposte(p_desposte_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_desp       public.despostes;
  v_lot        public.purchase_lots;
  v_total_cost numeric;
  v_unit_cost  numeric;
  v_item       public.desposte_items;
  v_despostado numeric;
  v_remaining  numeric;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_desp from public.despostes
  where id = p_desposte_id for update;
  if not found then
    raise exception 'Desposte no encontrado';
  end if;
  if v_desp.status <> 'in_progress' then
    raise exception 'El desposte ya fue finalizado';
  end if;
  if not exists (select 1 from public.desposte_items
                 where desposte_id = p_desposte_id) then
    raise exception 'No se puede finalizar un desposte sin cortes';
  end if;

  select * into v_lot from public.purchase_lots where id = v_desp.lot_id;
  v_total_cost := public._lot_total_cost(v_lot);
  -- Costo unitario por corte = costo total del lote / kg de canal (spec §8.5)
  v_unit_cost  := round(v_total_cost / nullif(v_lot.carcass_weight_kg, 0), 4);

  for v_item in
    select * from public.desposte_items where desposte_id = p_desposte_id
  loop
    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, created_by
    ) values (
      v_item.product_id, 'entry_desposte', v_item.weight_kg,
      coalesce(v_unit_cost, 0),
      'desposte_item', v_item.id, auth.uid()
    );
  end loop;

  update public.despostes
     set status = 'finalized', finalized_at = now()
   where id = p_desposte_id;

  -- Cierre automático si el lote quedó agotado (tolerancia 0.5 kg, §9.4)
  select coalesce(sum(input_weight_kg), 0) into v_despostado
  from public.despostes
  where lot_id = v_lot.id and status = 'finalized';

  v_remaining := coalesce(v_lot.carcass_weight_kg, 0) - v_despostado;
  if v_remaining <= 0.5 then
    update public.purchase_lots
       set status = 'closed', closed_at = now()
     where id = v_lot.id and status <> 'closed';
  end if;
end;
$$;

-- ---- Iniciar conteo físico (snapshot del teórico) ------------------------
create or replace function public.fn_start_physical_count(
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  insert into public.physical_counts (status, notes, created_by)
  values ('in_progress', p_notes, auth.uid())
  returning id into v_count_id;

  insert into public.physical_count_items (
    physical_count_id, product_id, theoretical_quantity, physical_quantity
  )
  select
    v_count_id, p.id,
    coalesce(sum(m.quantity), 0),
    null
  from public.products p
  left join public.inventory_movements m on m.product_id = p.id
  where p.active = true
  group by p.id;

  return v_count_id;
end;
$$;

-- ---- Completar conteo físico (admin) y aplicar ajustes -------------------
-- p_apply_adjustments = true crea movimientos physical_count_adjustment por
-- las diferencias (físico - teórico) de los productos indicados (o todos los
-- que difieran si p_product_ids es null). Productos no incluidos quedan
-- "marcados para investigación": sin movimiento, solo el conteo registrado.
create or replace function public.fn_complete_physical_count(
  p_count_id           uuid,
  p_apply_adjustments  boolean default false,
  p_product_ids        uuid[]  default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count public.physical_counts;
  v_it    record;
  v_avg   numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede completar un conteo';
  end if;

  select * into v_count from public.physical_counts
  where id = p_count_id for update;
  if not found then
    raise exception 'Conteo no encontrado';
  end if;
  if v_count.status = 'completed' then
    raise exception 'El conteo ya está completado';
  end if;
  if exists (select 1 from public.physical_count_items
             where physical_count_id = p_count_id
               and physical_quantity is null) then
    raise exception 'Faltan productos por contar';
  end if;

  if p_apply_adjustments then
    for v_it in
      select pci.product_id,
             (pci.physical_quantity - pci.theoretical_quantity) as diff
      from public.physical_count_items pci
      where pci.physical_count_id = p_count_id
        and pci.physical_quantity <> pci.theoretical_quantity
        and (p_product_ids is null
             or pci.product_id = any (p_product_ids))
    loop
      -- Costo unitario del ajuste = promedio ponderado actual del producto
      select coalesce(
               sum(case when quantity > 0 then quantity * unit_cost end)
                 / nullif(sum(case when quantity > 0 then quantity end), 0),
               0)
        into v_avg
      from public.inventory_movements
      where product_id = v_it.product_id;

      insert into public.inventory_movements (
        product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, notes, created_by
      ) values (
        v_it.product_id, 'physical_count_adjustment', v_it.diff,
        round(coalesce(v_avg, 0), 4),
        'physical_count', p_count_id,
        'Ajuste por conteo físico', auth.uid()
      );
    end loop;
  end if;

  update public.physical_counts
     set status = 'completed', completed_at = now()
   where id = p_count_id;
end;
$$;

-- Exponer las funciones por RPC a usuarios autenticados
grant execute on function public.fn_create_lot_live          to authenticated;
grant execute on function public.fn_create_lot_carcass       to authenticated;
grant execute on function public.fn_register_lot_arrival     to authenticated;
grant execute on function public.fn_register_direct_purchase to authenticated;
grant execute on function public.fn_start_desposte           to authenticated;
grant execute on function public.fn_finalize_desposte        to authenticated;
grant execute on function public.fn_start_physical_count     to authenticated;
grant execute on function public.fn_complete_physical_count  to authenticated;
grant execute on function public.is_admin                    to authenticated;
grant execute on function public.is_active_user              to authenticated;

-- ============================================================================
-- FIN BLOQUE F
-- ============================================================================


-- ============================================================================
-- BLOQUE G · TRIGGER auth.users -> profiles
-- ----------------------------------------------------------------------------
-- Al crear un usuario en Supabase Auth se crea su profile automáticamente,
-- tomando full_name y role de user_metadata. Si no viene role, default
-- 'employee'. SECURITY DEFINER para poder escribir en profiles.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'employee'),
    true
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- FIN BLOQUE G
-- ============================================================================


-- ============================================================================
-- BLOQUE H · BUCKET STORAGE 'receipts' + POLICIES
-- ----------------------------------------------------------------------------
-- Bucket privado. Solo usuarios autenticados leen/suben. Ruta de archivo:
-- {entity_type}/{entity_id}/{timestamp}_{filename} (spec §6.13).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipts_read   on storage.objects;
drop policy if exists receipts_upload on storage.objects;

create policy receipts_read on storage.objects
  for select using (
    bucket_id = 'receipts' and public.is_active_user()
  );

create policy receipts_upload on storage.objects
  for insert with check (
    bucket_id = 'receipts' and public.is_active_user()
  );

-- ============================================================================
-- FIN BLOQUE H · FIN DE LA MIGRACIÓN 001
-- ----------------------------------------------------------------------------
-- Migración completa. Ejecutar entera en el SQL Editor de Supabase.
-- Después correr supabase/seed.sql para usuarios, proveedores y productos.
-- ============================================================================
