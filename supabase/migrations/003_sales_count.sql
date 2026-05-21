-- ============================================================================
-- 003 · Conteo quincenal de ventas
-- ----------------------------------------------------------------------------
-- Reusa las tablas physical_counts / physical_count_items con esta semántica
-- para el conteo quincenal (ver docs/DECISIONS.md D-014):
--   theoretical_quantity = stock teórico al iniciar el conteo
--   physical_quantity    = cantidad VENDIDA en el período (la digita Félix)
--   esperado (calculado)  = theoretical_quantity - physical_quantity
--
-- Al finalizar, las ventas se aplican como movimientos de salida para que el
-- inventario teórico baje y refleje lo que debe quedar.
-- ============================================================================

-- Inicia un conteo: toma foto del stock de los productos que HOY tienen
-- existencia (> 0). Los productos en cero no entran.
create or replace function public.fn_start_sales_count(
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede iniciar un conteo';
  end if;

  insert into public.physical_counts (status, notes, created_by)
  values ('in_progress', p_notes, auth.uid())
  returning id into v_id;

  insert into public.physical_count_items (
    physical_count_id, product_id, theoretical_quantity, physical_quantity
  )
  select v_id, p.id, coalesce(sum(m.quantity), 0), null
  from public.products p
  join public.inventory_movements m on m.product_id = p.id
  where p.active = true
  group by p.id
  having coalesce(sum(m.quantity), 0) > 0;

  return v_id;
end;
$$;

-- Finaliza un conteo: por cada producto con venta registrada (> 0) crea un
-- movimiento de salida; así el inventario teórico baja a "lo que debe quedar".
create or replace function public.fn_complete_sales_count(
  p_count_id uuid
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
    raise exception 'Solo el administrador puede finalizar un conteo';
  end if;

  select * into v_count from public.physical_counts
  where id = p_count_id for update;
  if not found then
    raise exception 'Conteo no encontrado';
  end if;
  if v_count.status = 'completed' then
    raise exception 'El conteo ya está completado';
  end if;

  for v_it in
    select product_id, physical_quantity
    from public.physical_count_items
    where physical_count_id = p_count_id
      and physical_quantity is not null
      and physical_quantity > 0
  loop
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
      v_it.product_id, 'adjustment_out', -v_it.physical_quantity,
      round(coalesce(v_avg, 0), 4),
      'physical_count', p_count_id,
      'Venta registrada en conteo quincenal', auth.uid()
    );
  end loop;

  update public.physical_counts
     set status = 'completed', completed_at = now()
   where id = p_count_id;
end;
$$;

grant execute on function public.fn_start_sales_count    to authenticated;
grant execute on function public.fn_complete_sales_count to authenticated;
