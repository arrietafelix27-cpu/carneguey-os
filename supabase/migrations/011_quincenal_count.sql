-- ============================================================================
-- 011 · Conteo quincenal de dos sesiones (ventas + conteo físico real)
-- ----------------------------------------------------------------------------
-- Antes el conteo era un solo paso: Félix registraba lo vendido y al
-- finalizar se aplicaban esas ventas como salidas. Ahora son dos sesiones:
--
--   Sesión 1 (ventas)         → physical_count_items.physical_quantity
--   Sesión 2 (conteo físico)  → physical_count_items.actual_quantity (NUEVA)
--
-- "Finalizar" ya NO descuenta las ventas: lleva el inventario de cada
-- producto al valor que Félix puso en "¿cuánto hay en realidad?" creando un
-- único movimiento de ajuste por la diferencia entre teórico y actual.
--
-- Además se agrega el estado 'cancelled' para conteos abandonados sin
-- tocar el inventario.
-- ============================================================================

-- 1) physical_counts.status permite 'cancelled'
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.physical_counts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%in_progress%'
  loop
    execute format('alter table public.physical_counts drop constraint %I', c);
  end loop;
end $$;

alter table public.physical_counts
  add constraint physical_counts_status_check
  check (status in ('in_progress', 'completed', 'cancelled'));

-- 2) physical_count_items.actual_quantity (lo realmente contado en sesión 2)
alter table public.physical_count_items
  add column if not exists actual_quantity numeric(10,2)
  check (actual_quantity is null or actual_quantity >= 0);

grant select (actual_quantity) on public.physical_count_items to authenticated;
grant update (actual_quantity) on public.physical_count_items to authenticated;

-- 3) Vista admin: incluye actual_quantity; las diferencias se calculan
--    en la capa de presentación porque dependen del par teórico/vendido.
drop view if exists public.v_physical_count_items_admin;
create view public.v_physical_count_items_admin as
select
  i.id,
  i.physical_count_id,
  i.product_id,
  p.name      as product_name,
  p.category,
  p.unit,
  i.theoretical_quantity,
  i.physical_quantity,
  i.actual_quantity,
  i.notes,
  i.created_at
from public.physical_count_items i
join public.products p on p.id = i.product_id
where public.is_admin();

grant select on public.v_physical_count_items_admin to authenticated;

-- 4) Guardar ventas (sesión 1) en bulk
create or replace function public.fn_save_count_sales(
  p_count_id uuid,
  p_items    jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count public.physical_counts;
  v_it    jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into v_count from public.physical_counts
  where id = p_count_id for update;
  if not found then
    raise exception 'Conteo no encontrado';
  end if;
  if v_count.status <> 'in_progress' then
    raise exception 'El conteo ya fue cerrado';
  end if;

  for v_it in select * from jsonb_array_elements(p_items)
  loop
    update public.physical_count_items
       set physical_quantity = nullif(v_it->>'sold', '')::numeric
     where id = (v_it->>'item_id')::uuid
       and physical_count_id = p_count_id;
  end loop;
end;
$$;

-- 5) Guardar conteo físico (sesión 2) en bulk
create or replace function public.fn_save_count_actuals(
  p_count_id uuid,
  p_items    jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count public.physical_counts;
  v_it    jsonb;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into v_count from public.physical_counts
  where id = p_count_id for update;
  if not found then
    raise exception 'Conteo no encontrado';
  end if;
  if v_count.status <> 'in_progress' then
    raise exception 'El conteo ya fue cerrado';
  end if;

  for v_it in select * from jsonb_array_elements(p_items)
  loop
    update public.physical_count_items
       set actual_quantity = nullif(v_it->>'actual', '')::numeric
     where id = (v_it->>'item_id')::uuid
       and physical_count_id = p_count_id;
  end loop;
end;
$$;

-- 6) Finalizar: lleva el inventario de cada producto a actual_quantity
create or replace function public.fn_finalize_quincenal_count(
  p_count_id uuid,
  p_notes    text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count public.physical_counts;
  v_it    record;
  v_delta numeric;
  v_avg   numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede finalizar el conteo';
  end if;

  select * into v_count from public.physical_counts
  where id = p_count_id for update;
  if not found then
    raise exception 'Conteo no encontrado';
  end if;
  if v_count.status <> 'in_progress' then
    raise exception 'El conteo ya fue cerrado';
  end if;

  for v_it in
    select product_id, theoretical_quantity, actual_quantity
    from public.physical_count_items
    where physical_count_id = p_count_id
      and actual_quantity is not null
  loop
    v_delta := v_it.actual_quantity - v_it.theoretical_quantity;
    if v_delta <> 0 then
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
        v_it.product_id,
        'physical_count_adjustment',
        v_delta,
        round(coalesce(v_avg, 0), 4),
        'physical_count',
        p_count_id,
        'Ajuste por conteo quincenal',
        auth.uid()
      );
    end if;
  end loop;

  update public.physical_counts
     set status       = 'completed',
         completed_at = now(),
         notes        = coalesce(p_notes, notes)
   where id = p_count_id;
end;
$$;

-- 7) Cancelar: marca como cancelado sin tocar inventario
create or replace function public.fn_cancel_quincenal_count(
  p_count_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count public.physical_counts;
begin
  if not public.is_admin() then
    raise exception 'No autorizado';
  end if;

  select * into v_count from public.physical_counts
  where id = p_count_id for update;
  if not found then
    raise exception 'Conteo no encontrado';
  end if;
  if v_count.status <> 'in_progress' then
    raise exception 'El conteo ya fue cerrado';
  end if;

  update public.physical_counts
     set status       = 'cancelled',
         completed_at = now()
   where id = p_count_id;
end;
$$;

grant execute on function public.fn_save_count_sales         to authenticated;
grant execute on function public.fn_save_count_actuals       to authenticated;
grant execute on function public.fn_finalize_quincenal_count to authenticated;
grant execute on function public.fn_cancel_quincenal_count   to authenticated;
