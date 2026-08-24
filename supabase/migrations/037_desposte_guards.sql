-- ============================================================================
-- 037 · Control de merma/inventario en desposte, transferencias y sub-despostes
-- ----------------------------------------------------------------------------
-- Decisiones de Félix (pulido Compras/Desposte):
--  1. No se puede finalizar un desposte si los cortes registrados pesan MÁS que
--     lo que entró (merma negativa, físicamente imposible). Sin excepción.
--  2. No se puede aprobar una transferencia ni un sub-desposte si no hay
--     suficiente inventario del corte/producto de origen. Sin excepción.
--  3. Solo quien inició el desposte (o el admin) puede cancelarlo, y solo
--     mientras está en curso (RLS).
--
-- Se reescriben las funciones (org-aware, de la 032) agregando los chequeos.
-- ============================================================================

-- ── 1. fn_finalize_desposte: bloquea merma negativa ────────────────────────
create or replace function public.fn_finalize_desposte(p_desposte_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_desp         public.despostes;
  v_lot          public.purchase_lots;
  v_total_cost   numeric;
  v_unit_cost    numeric;
  v_output_total numeric;
  v_qty          numeric;
  v_item_cost    numeric;
  v_item         record;
  v_despostado   numeric;
  v_remaining    numeric;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_desp from public.despostes
  where id = p_desposte_id and organization_id = public.current_org_id()
  for update;
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

  -- Merma negativa: los cortes no pueden pesar más que lo que entró.
  select coalesce(sum(weight_kg), 0) into v_output_total
  from public.desposte_items where desposte_id = p_desposte_id;
  if v_output_total > v_desp.input_weight_kg + 0.001 then
    raise exception
      'Los cortes registrados (% kg) pesan más que lo que entró al desposte (% kg). Revisa los pesos antes de finalizar.',
      round(v_output_total, 2), round(v_desp.input_weight_kg, 2);
  end if;

  select * into v_lot from public.purchase_lots
  where id = v_desp.lot_id and organization_id = public.current_org_id();
  v_total_cost := public._lot_total_cost(v_lot);
  v_unit_cost  := round(v_total_cost / nullif(v_lot.carcass_weight_kg, 0), 4);

  for v_item in
    select di.*, p.unit as product_unit
    from public.desposte_items di
    join public.products p on p.id = di.product_id
    where di.desposte_id = p_desposte_id
  loop
    if v_item.product_unit = 'unit' then
      v_qty := coalesce(v_item.unit_count, v_item.weight_kg)::numeric;
      if v_item.unit_count is not null and v_item.unit_count > 0 then
        v_item_cost := round(
          coalesce(v_unit_cost, 0) * v_item.weight_kg / v_item.unit_count, 4);
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

-- ── 2a. fn_review_cut_transfer: bloquea si no hay stock en el origen ────────
create or replace function public.fn_review_cut_transfer(
  p_transfer_id uuid,
  p_approve     boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t     public.cut_transfers;
  v_avg   numeric;
  v_stock numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede revisar transferencias';
  end if;

  select * into v_t from public.cut_transfers
  where id = p_transfer_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Transferencia no encontrada';
  end if;
  if v_t.status <> 'pending' then
    raise exception 'La transferencia ya fue revisada';
  end if;

  if p_approve then
    select coalesce(sum(quantity), 0) into v_stock
    from public.inventory_movements
    where product_id = v_t.source_product_id
      and organization_id = public.current_org_id();
    if v_stock < v_t.quantity_kg then
      raise exception
        'No hay suficiente inventario del corte de origen (disponible % kg, se piden % kg).',
        round(v_stock, 2), round(v_t.quantity_kg, 2);
    end if;

    select coalesce(
             sum(case when quantity > 0 then quantity * unit_cost end)
               / nullif(sum(case when quantity > 0 then quantity end), 0),
             0)
      into v_avg
    from public.inventory_movements
    where product_id = v_t.source_product_id
      and organization_id = public.current_org_id();

    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      v_t.source_product_id, 'adjustment_out', -v_t.quantity_kg,
      round(coalesce(v_avg, 0), 4),
      'cut_transfer', v_t.id,
      'Transferencia de corte — salida', auth.uid()
    );

    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      v_t.dest_product_id, 'adjustment_in', v_t.quantity_kg,
      round(coalesce(v_avg, 0), 4),
      'cut_transfer', v_t.id,
      'Transferencia de corte — entrada', auth.uid()
    );

    update public.cut_transfers
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_transfer_id;
  else
    update public.cut_transfers
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_transfer_id;
  end if;
end;
$$;

-- ── 2b. fn_review_sub_desposte: bloquea si no hay stock en el origen ────────
create or replace function public.fn_review_sub_desposte(
  p_sub_id  uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sd          public.sub_despostes;
  v_avg         numeric;
  v_out_total   numeric;
  v_cost_per_kg numeric;
  v_stock       numeric;
  v_item        record;
  v_qty         numeric;
  v_item_cost   numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede revisar sub-despostes';
  end if;

  select * into v_sd from public.sub_despostes
  where id = p_sub_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Sub-desposte no encontrado';
  end if;
  if v_sd.status <> 'pending' then
    raise exception 'El sub-desposte ya fue revisado';
  end if;

  if p_approve then
    if not exists (select 1 from public.sub_desposte_items
                   where sub_desposte_id = p_sub_id) then
      raise exception 'No se puede aprobar un sub-desposte sin productos resultantes';
    end if;

    select coalesce(sum(quantity), 0) into v_stock
    from public.inventory_movements
    where product_id = v_sd.source_product_id
      and organization_id = public.current_org_id();
    if v_stock < v_sd.source_kg then
      raise exception
        'No hay suficiente inventario del producto de origen (disponible % kg, se piden % kg).',
        round(v_stock, 2), round(v_sd.source_kg, 2);
    end if;

    select coalesce(
             sum(case when quantity > 0 then quantity * unit_cost end)
               / nullif(sum(case when quantity > 0 then quantity end), 0),
             0)
      into v_avg
    from public.inventory_movements
    where product_id = v_sd.source_product_id
      and organization_id = public.current_org_id();

    select coalesce(sum(weight_kg), 0) into v_out_total
    from public.sub_desposte_items where sub_desposte_id = p_sub_id;

    v_cost_per_kg := round(
      (v_sd.source_kg * coalesce(v_avg, 0)) / nullif(v_out_total, 0), 4);

    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      v_sd.source_product_id, 'adjustment_out', -v_sd.source_kg,
      round(coalesce(v_avg, 0), 4),
      'sub_desposte', v_sd.id,
      'Sub-desposte — salida del origen', auth.uid()
    );

    for v_item in
      select sdi.*, p.unit as product_unit
      from public.sub_desposte_items sdi
      join public.products p on p.id = sdi.product_id
      where sdi.sub_desposte_id = p_sub_id
    loop
      if v_item.product_unit = 'unit' and v_item.unit_count is not null
         and v_item.unit_count > 0 then
        v_qty := v_item.unit_count;
        v_item_cost := round(
          v_cost_per_kg * v_item.weight_kg / v_item.unit_count, 4);
      else
        v_qty := v_item.weight_kg;
        v_item_cost := v_cost_per_kg;
      end if;

      insert into public.inventory_movements (
        product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, notes, created_by
      ) values (
        v_item.product_id, 'adjustment_in', v_qty,
        coalesce(v_item_cost, 0),
        'sub_desposte', v_sd.id,
        'Sub-desposte — producto resultante', auth.uid()
      );
    end loop;

    update public.sub_despostes
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_sub_id;
  else
    update public.sub_despostes
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_sub_id;
  end if;
end;
$$;

-- ── 3. Cancelar desposte: solo quien lo inició o el admin, y en curso ──────
drop policy if exists desp_delete on public.despostes;
create policy desp_delete on public.despostes
  for delete using (
    organization_id = public.current_org_id()
    and public.is_active_user()
    and status = 'in_progress'
    and (created_by = auth.uid() or public.is_admin())
  );
