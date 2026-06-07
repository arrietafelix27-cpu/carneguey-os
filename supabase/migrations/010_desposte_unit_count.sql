-- ============================================================================
-- 010 · Desposte: separar unidades del peso para productos unit
-- ----------------------------------------------------------------------------
-- Para productos con unit='unit' (ej. Galillo, Pollo entero), el desposte
-- pasa a registrar DOS datos por corte:
--   · cuántas unidades salieron  (entran al inventario)
--   · cuántos kg pesan en total  (descuentan del lote)
--
-- desposte_items.weight_kg pasa a significar SIEMPRE kg reales del corte.
-- desposte_items.unit_count guarda las unidades (null para productos kg).
--
-- fn_finalize_desposte usa unit_count como cantidad de inventario para
-- productos unit, y ajusta el unit_cost para que el valor del inventario
-- siga cuadrando: valor = kg × costo_por_kg_canal, repartido entre las
-- unidades.
--
-- Para items anteriores a esta migración (unit_count null) se cae al
-- comportamiento viejo: weight_kg se interpreta como la cantidad.
-- ============================================================================

alter table public.desposte_items
  add column unit_count integer
  check (unit_count is null or unit_count > 0);

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
  v_qty        numeric;
  v_item_cost  numeric;
  v_item       record;
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
  v_unit_cost  := round(v_total_cost / nullif(v_lot.carcass_weight_kg, 0), 4);

  for v_item in
    select di.*, p.unit as product_unit
    from public.desposte_items di
    join public.products p on p.id = di.product_id
    where di.desposte_id = p_desposte_id
  loop
    if v_item.product_unit = 'unit' then
      -- Cantidad en inventario = unidades (o weight_kg para datos viejos).
      v_qty := coalesce(v_item.unit_count, v_item.weight_kg)::numeric;
      -- Costo por unidad: el valor total = weight_kg × costo_canal_por_kg,
      -- repartido entre las unidades. Datos viejos caen al costo por kg.
      if v_item.unit_count is not null and v_item.unit_count > 0 then
        v_item_cost := round(
          coalesce(v_unit_cost, 0) * v_item.weight_kg / v_item.unit_count,
          4
        );
      else
        v_item_cost := coalesce(v_unit_cost, 0);
      end if;
    else
      v_qty := v_item.weight_kg;
      v_item_cost := coalesce(v_unit_cost, 0);
    end if;

    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, created_by
    ) values (
      v_item.product_id, 'entry_desposte', v_qty, v_item_cost,
      'desposte_item', v_item.id, auth.uid()
    );
  end loop;

  update public.despostes
     set status = 'finalized', finalized_at = now()
   where id = p_desposte_id;

  -- Cierre automático del lote si se agotó (tolerancia 0.5 kg).
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
