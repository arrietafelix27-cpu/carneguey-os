-- ============================================================================
-- 009 · Soporte para lotes de pollo en canal (poultry_carcass) y prefijo POL
-- ----------------------------------------------------------------------------
-- Habilita un nuevo tipo de lote para los pollos enteros que se compran y
-- van al cuarto frío para despostarse después. Se asigna el prefijo POL al
-- código (POL-2026-001, POL-2026-002, ...).
--
-- Cambios:
--   1. Ampliar el CHECK de purchase_lots.type para incluir 'poultry_carcass'.
--   2. Ampliar el CHECK de lot_code_counters.prefix para incluir 'POL'.
--   3. Actualizar gen_lot_code para mapear poultry_carcass -> POL.
--   4. Actualizar _lot_category para mapear poultry_carcass -> poultry.
--   5. Permitir poultry_carcass en fn_create_lot_carcass.
--   6. Relajar la validación del trigger _check_desposte_item: la categoría
--      sigue siendo obligatoria pero el origen del producto deja de exigirse
--      (los productos de pollo del catálogo son direct_purchase por defecto
--      pero también pueden salir de un desposte de pollo).
-- ============================================================================

-- 1. CHECK de purchase_lots.type
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.purchase_lots'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%beef_live%pork_carcass%'
  loop
    execute format(
      'alter table public.purchase_lots drop constraint %I',
      c.conname
    );
  end loop;
end $$;

alter table public.purchase_lots
  add constraint purchase_lots_type_check
  check (type in ('beef_live', 'beef_carcass', 'pork_carcass', 'poultry_carcass'));

-- 2. CHECK de lot_code_counters.prefix
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.lot_code_counters'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%prefix%RES%CER%'
  loop
    execute format(
      'alter table public.lot_code_counters drop constraint %I',
      c.conname
    );
  end loop;
end $$;

alter table public.lot_code_counters
  add constraint lot_code_counters_prefix_check
  check (prefix in ('RES', 'CER', 'POL'));

-- 3. gen_lot_code con prefijo POL para pollo
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
    when p_type = 'poultry_carcass'              then 'POL'
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

-- 4. _lot_category con mapeo para pollo
create or replace function public._lot_category(p_type text)
returns text
language sql
immutable
as $$
  select case
    when p_type in ('beef_live', 'beef_carcass') then 'beef'
    when p_type = 'pork_carcass'                 then 'pork'
    when p_type = 'poultry_carcass'              then 'poultry'
    else null
  end;
$$;

-- 5. fn_create_lot_carcass acepta poultry_carcass
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
  if p_type not in ('beef_carcass', 'pork_carcass', 'poultry_carcass') then
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
  returning purchase_lots.id, purchase_lots.lot_code
  into v_id, v_code;

  return query select v_id, v_code;
end;
$$;

-- 6. _check_desposte_item: la categoría sigue siendo obligatoria,
--    el origen del producto deja de exigirse (necesario para que los cortes
--    de pollo del catálogo, que son direct_purchase, se puedan usar en
--    despostes de pollo).
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
  if v_prod.category <> public._lot_category(v_lot_type) then
    raise exception 'El producto % no corresponde a la categoría del lote',
      v_prod.name;
  end if;
  return new;
end;
$$;
