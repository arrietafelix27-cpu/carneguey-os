-- ============================================================================
-- 032 · Funciones SECURITY DEFINER org-aware (Fase 1)
-- ----------------------------------------------------------------------------
-- Las funciones fn_* corren como owner (bypass RLS), así que deben aislar por
-- organización ellas mismas. Estrategia:
--   · Los INSERT NO se tocan: en 033 la columna organization_id lleva
--     DEFAULT current_org_id(), así toda fila insertada recibe la org correcta
--     automáticamente (imposible olvidarlo).
--   · Aquí se cierran los dos huecos que el DEFAULT no cubre:
--       (a) leer/modificar una fila de OTRA org pasando su id como parámetro
--           → se pliega  "and organization_id = current_org_id()"  en el SELECT
--           que la busca (o se valida provider/product/employee/customer).
--       (b) funciones que agregan datos sin filtrar por org (fn_daily_summary)
--           → se agrega el filtro por org.
--
-- gen_lot_code y fn_close_day quedan para 033: dependen de constraints (PK/
-- unique compuestas) que se crean allí.
-- ============================================================================

-- ── Borrar funciones legacy sin uso (evita superficie de fuga) ─────────────
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig from pg_proc
    where proname in (
      'fn_start_physical_count','fn_complete_physical_count','fn_complete_sales_count'
    ) and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

-- ── fn_start_desposte ───────────────────────────────────────────────────────
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

  select * into v_lot from public.purchase_lots
  where id = p_lot_id and organization_id = public.current_org_id();
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

-- ── fn_finalize_desposte ────────────────────────────────────────────────────
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

-- ── fn_register_lot_arrival ─────────────────────────────────────────────────
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

  select * into v_lot from public.purchase_lots
  where id = p_lot_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if v_lot.type <> 'beef_live' or v_lot.status <> 'pending_arrival' then
    raise exception 'El lote no está pendiente de llegada';
  end if;

  update public.purchase_lots
     set carcass_count     = p_carcass_count,
         carcass_weight_kg = p_carcass_weight_kg,
         arrival_date      = p_arrival_date,
         status            = 'active',
         activated_by      = auth.uid(),
         activated_at      = now(),
         notes             = coalesce(p_notes, notes)
   where id = p_lot_id;
end;
$$;

-- ── fn_close_lot_with_merma ─────────────────────────────────────────────────
create or replace function public.fn_close_lot_with_merma(p_lot_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot        public.purchase_lots;
  v_despostado numeric;
  v_remaining  numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede finalizar lotes';
  end if;

  select * into v_lot from public.purchase_lots
  where id = p_lot_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if v_lot.status <> 'active' then
    raise exception 'Solo se pueden finalizar lotes activos';
  end if;

  select coalesce(sum(input_weight_kg), 0) into v_despostado
  from public.despostes
  where lot_id = p_lot_id and status = 'finalized';

  v_remaining := round(coalesce(v_lot.carcass_weight_kg, 0) - v_despostado, 2);
  if v_remaining < 0 then
    v_remaining := 0;
  end if;

  update public.purchase_lots
     set status         = 'closed',
         closed_at      = now(),
         closed_by      = auth.uid(),
         final_merma_kg = v_remaining
   where id = p_lot_id;
end;
$$;

-- ── fn_create_lot_carcass (valida proveedor de la org) ─────────────────────
create or replace function public.fn_create_lot_carcass(
  p_type                   text,
  p_provider_id            uuid,
  p_carcass_count          int,
  p_carcass_weight_kg      numeric,
  p_carcass_purchase_cost  numeric,
  p_carcass_transport_cost numeric default 0,
  p_arrival_date           date    default current_date,
  p_notes                  text    default null,
  p_payment_method         text    default 'cash',
  p_due_date               date    default null
)
returns table (lot_id uuid, lot_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_code  text;
  v_total numeric;
  v_label text;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_type not in ('beef_carcass', 'pork_carcass', 'poultry_carcass') then
    raise exception 'Tipo inválido para canal directo: %', p_type;
  end if;
  if p_payment_method not in ('cash', 'credit') then
    raise exception 'Forma de pago inválida';
  end if;
  if not exists (select 1 from public.providers
                 where id = p_provider_id
                   and organization_id = public.current_org_id()) then
    raise exception 'Proveedor no válido';
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

  if p_payment_method = 'credit' then
    v_total := p_carcass_purchase_cost + coalesce(p_carcass_transport_cost, 0);
    v_label := case p_type
                 when 'beef_carcass'    then 'Canal directo (res)'
                 when 'pork_carcass'    then 'Cerdo en canal'
                 when 'poultry_carcass' then 'Pollo para desposte'
               end;

    insert into public.supplier_invoices (
      provider_id, amount, description, due_date, status, is_private,
      purchase_lot_id, created_by
    ) values (
      p_provider_id, v_total,
      v_label || ' · ' || to_char(p_arrival_date, 'DD/MM/YYYY'),
      p_due_date, 'pending', false,
      v_id, auth.uid()
    );
  end if;

  return query select v_id, v_code;
end;
$$;

-- ── fn_create_lot_live (valida proveedor de la org) ────────────────────────
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
  p_notes                       text    default null,
  p_payment_method              text    default 'cash',
  p_due_date                    date    default null
)
returns table (lot_id uuid, lot_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_code  text;
  v_total numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede crear lotes de ganado en pie';
  end if;
  if p_payment_method not in ('cash', 'credit') then
    raise exception 'Forma de pago inválida';
  end if;
  if not exists (select 1 from public.providers
                 where id = p_provider_id
                   and organization_id = public.current_org_id()) then
    raise exception 'Proveedor no válido';
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
  returning purchase_lots.id, purchase_lots.lot_code
  into v_id, v_code;

  if p_payment_method = 'credit' then
    v_total := p_live_purchase_cost
             + coalesce(p_transport_to_slaughter_cost, 0)
             + coalesce(p_slaughter_cost, 0)
             + coalesce(p_transport_to_shop_cost, 0)
             + coalesce(p_other_costs, 0);

    insert into public.supplier_invoices (
      provider_id, amount, description, due_date, status, is_private,
      purchase_lot_id, created_by
    ) values (
      p_provider_id, v_total,
      'Ganado en pie · ' || to_char(p_live_purchase_date, 'DD/MM/YYYY'),
      p_due_date, 'pending', false,
      v_id, auth.uid()
    );
  end if;

  return query select v_id, v_code;
end;
$$;

-- ── fn_register_direct_purchase (valida proveedor y cada producto) ─────────
create or replace function public.fn_register_direct_purchase(
  p_provider_id    uuid,
  p_purchase_date  date,
  p_items          jsonb,
  p_notes          text default null,
  p_payment_method text default 'cash',
  p_due_date       date default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item        jsonb;
  v_product_id  uuid;
  v_qty         numeric;
  v_total       numeric;
  v_dp_id       uuid;
  v_first_dp_id uuid;
  v_sum_total   numeric := 0;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay productos en la compra';
  end if;
  if p_payment_method not in ('cash', 'credit') then
    raise exception 'Forma de pago inválida';
  end if;
  if not exists (select 1 from public.providers
                 where id = p_provider_id
                   and organization_id = public.current_org_id()) then
    raise exception 'Proveedor no válido';
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
    if not exists (select 1 from public.products
                   where id = v_product_id
                     and organization_id = public.current_org_id()) then
      raise exception 'Producto no válido';
    end if;

    insert into public.direct_purchases (
      provider_id, product_id, quantity, total_cost,
      purchase_date, notes, created_by
    ) values (
      p_provider_id, v_product_id, v_qty, v_total,
      p_purchase_date, p_notes, auth.uid()
    )
    returning id into v_dp_id;

    if v_first_dp_id is null then
      v_first_dp_id := v_dp_id;
    end if;
    v_sum_total := v_sum_total + v_total;

    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, created_by
    ) values (
      v_product_id, 'entry_direct', v_qty,
      round(v_total / v_qty, 4),
      'direct_purchase', v_dp_id, auth.uid()
    );
  end loop;

  if p_payment_method = 'credit' then
    insert into public.supplier_invoices (
      provider_id, amount, description, due_date, status, is_private,
      direct_purchase_id, created_by
    ) values (
      p_provider_id, v_sum_total,
      'Compra directa · ' || to_char(p_purchase_date, 'DD/MM/YYYY'),
      p_due_date, 'pending', false,
      v_first_dp_id, auth.uid()
    );
  end if;
end;
$$;

-- ── fn_review_cut_transfer ──────────────────────────────────────────────────
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
  v_t   public.cut_transfers;
  v_avg numeric;
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

-- ── fn_review_sub_desposte ──────────────────────────────────────────────────
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

-- ── fn_start_sales_count (snapshot solo de productos de la org) ────────────
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
    and p.organization_id = public.current_org_id()
  group by p.id
  having coalesce(sum(m.quantity), 0) > 0;

  return v_id;
end;
$$;

-- ── fn_save_count_sales ─────────────────────────────────────────────────────
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
  where id = p_count_id and organization_id = public.current_org_id()
  for update;
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

-- ── fn_save_count_actuals ───────────────────────────────────────────────────
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
  where id = p_count_id and organization_id = public.current_org_id()
  for update;
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

-- ── fn_finalize_quincenal_count ─────────────────────────────────────────────
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
  where id = p_count_id and organization_id = public.current_org_id()
  for update;
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
      where product_id = v_it.product_id
        and organization_id = public.current_org_id();

      insert into public.inventory_movements (
        product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, notes, created_by
      ) values (
        v_it.product_id, 'physical_count_adjustment', v_delta,
        round(coalesce(v_avg, 0), 4),
        'physical_count', p_count_id,
        'Ajuste por conteo quincenal', auth.uid()
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

-- ── fn_cancel_quincenal_count ───────────────────────────────────────────────
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
  where id = p_count_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Conteo no encontrado';
  end if;
  if v_count.status <> 'in_progress' then
    raise exception 'El conteo ya fue cerrado';
  end if;

  update public.physical_counts
     set status = 'cancelled', completed_at = now()
   where id = p_count_id;
end;
$$;

-- ── fn_complete_sale (valida cliente y cada producto de la org) ────────────
create or replace function public.fn_complete_sale(
  p_payment_method text,
  p_customer_id    uuid,
  p_subtotal       numeric,
  p_discount_total numeric,
  p_total          numeric,
  p_amount_paid    numeric,
  p_change_given   numeric,
  p_items          jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale_id uuid;
  v_status  text;
  v_paid    numeric;
  v_change  numeric;
  v_it      jsonb;
  v_pid     uuid;
  v_qty     numeric;
  v_avg     numeric;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_payment_method not in ('cash', 'card', 'transfer', 'credit') then
    raise exception 'Método de pago no permitido';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  if p_customer_id is not null
     and not exists (select 1 from public.customers
                     where id = p_customer_id
                       and organization_id = public.current_org_id()) then
    raise exception 'Cliente no válido';
  end if;

  if p_payment_method = 'credit' then
    if p_customer_id is null then
      raise exception 'Una venta a crédito requiere un cliente';
    end if;
    v_status := 'credit_pending';
    v_paid   := 0;
    v_change := 0;
  else
    v_status := 'completed';
    v_paid   := p_amount_paid;
    v_change := p_change_given;
  end if;

  insert into public.sales (
    created_by, customer_id, payment_method,
    subtotal, discount_total, total, amount_paid, change_given, status
  ) values (
    auth.uid(), p_customer_id, p_payment_method,
    p_subtotal, coalesce(p_discount_total, 0), p_total,
    v_paid, v_change, v_status
  )
  returning id into v_sale_id;

  for v_it in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_it->>'product_id')::uuid;
    v_qty := (v_it->>'quantity')::numeric;

    if not exists (select 1 from public.products
                   where id = v_pid
                     and organization_id = public.current_org_id()) then
      raise exception 'Producto no válido';
    end if;

    insert into public.sale_items (
      sale_id, product_id, quantity, unit_price, total_price
    ) values (
      v_sale_id, v_pid, v_qty,
      (v_it->>'unit_price')::numeric,
      (v_it->>'total_price')::numeric
    );

    select coalesce(
             sum(case when quantity > 0 then quantity * unit_cost end)
               / nullif(sum(case when quantity > 0 then quantity end), 0),
             0)
      into v_avg
    from public.inventory_movements
    where product_id = v_pid
      and organization_id = public.current_org_id();

    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      v_pid, 'sale', -v_qty, round(coalesce(v_avg, 0), 4),
      'sale', v_sale_id, 'Venta POS', auth.uid()
    );
  end loop;

  return v_sale_id;
end;
$$;

-- ── fn_review_cash_outflow ──────────────────────────────────────────────────
create or replace function public.fn_review_cash_outflow(
  p_outflow_id uuid,
  p_approve    boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_o public.cash_outflows;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede revisar egresos';
  end if;

  select * into v_o from public.cash_outflows
  where id = p_outflow_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Egreso no encontrado';
  end if;
  if v_o.status <> 'pending' then
    raise exception 'El egreso ya fue revisado';
  end if;

  update public.cash_outflows
     set status      = case when p_approve then 'approved' else 'rejected' end,
         approved_by = auth.uid(),
         approved_at = now()
   where id = p_outflow_id;

  update public.employee_loans
     set status = case when p_approve then 'approved' else 'rejected' end
   where cash_outflow_id = p_outflow_id;
end;
$$;

-- ── fn_register_supplier_payment ────────────────────────────────────────────
create or replace function public.fn_register_supplier_payment(
  p_invoice_id     uuid,
  p_amount         numeric,
  p_payment_source text,
  p_notes          text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice     public.supplier_invoices%rowtype;
  v_paid_before numeric;
  v_paid_after  numeric;
  v_payment_id  uuid;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;
  if p_payment_source not in ('cash', 'owner_contribution') then
    raise exception 'Fuente de pago no permitida';
  end if;

  select * into v_invoice
  from public.supplier_invoices
  where id = p_invoice_id and organization_id = public.current_org_id()
  for update;

  if not found then
    raise exception 'Factura no encontrada';
  end if;
  if v_invoice.is_private and not public.is_admin() then
    raise exception 'No autorizado para pagar esta factura';
  end if;
  if exists (
    select 1 from public.providers p
    where p.id = v_invoice.provider_id and p.is_private = true
  ) and not public.is_admin() then
    raise exception 'No autorizado para pagar esta factura';
  end if;
  if v_invoice.status = 'paid' then
    raise exception 'Esta factura ya está pagada';
  end if;

  select coalesce(sum(amount), 0) into v_paid_before
  from public.supplier_payments
  where supplier_invoice_id = p_invoice_id;

  if p_amount > (v_invoice.amount - v_paid_before) then
    raise exception 'El pago excede el saldo pendiente';
  end if;

  insert into public.supplier_payments (
    supplier_invoice_id, amount, payment_method, payment_source, notes, created_by
  ) values (
    p_invoice_id, p_amount, 'cash', p_payment_source, p_notes, auth.uid()
  )
  returning id into v_payment_id;

  v_paid_after := v_paid_before + p_amount;

  update public.supplier_invoices
  set status = case
                 when v_paid_after >= amount then 'paid'
                 when v_paid_after > 0 then 'partial'
                 else 'pending'
               end
  where id = p_invoice_id;

  return v_payment_id;
end;
$$;

-- ── fn_create_employee_loan (valida empleado de la org) ────────────────────
create or replace function public.fn_create_employee_loan(
  p_employee_id uuid,
  p_amount      numeric,
  p_notes       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outflow_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;
  if not exists (
    select 1 from public.employees
    where id = p_employee_id and active
      and organization_id = public.current_org_id()
  ) then
    raise exception 'Empleado no válido';
  end if;

  insert into public.cash_outflows (created_by, amount, category, notes)
  values (auth.uid(), p_amount, 'employee_advance', p_notes)
  returning id into v_outflow_id;

  insert into public.employee_loans (
    employee_id, amount, status, notes, cash_outflow_id, created_by
  ) values (
    p_employee_id, p_amount, 'pending', p_notes, v_outflow_id, auth.uid()
  );

  return v_outflow_id;
end;
$$;

-- ── fn_register_payroll_payment (valida empleado y préstamos de la org) ────
create or replace function public.fn_register_payroll_payment(
  p_payment_date date,
  p_period       text,
  p_employee_id  uuid,
  p_gross        numeric,
  p_net          numeric,
  p_notes        text,
  p_receipt_url  text,
  p_deductions   jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment_id uuid;
  v_total_ded  numeric := 0;
  v_d          jsonb;
  v_loan_id    uuid;
  v_amount     numeric;
  v_remaining  numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede registrar pagos de nómina';
  end if;
  if p_period not in ('first', 'second') then
    raise exception 'Período inválido';
  end if;
  if not exists (select 1 from public.employees
                 where id = p_employee_id
                   and organization_id = public.current_org_id()) then
    raise exception 'Empleado no válido';
  end if;

  if p_deductions is not null then
    for v_d in select * from jsonb_array_elements(p_deductions)
    loop
      v_amount := coalesce((v_d->>'amount')::numeric, 0);
      if v_amount <= 0 then continue; end if;
      v_total_ded := v_total_ded + v_amount;

      v_loan_id := nullif(v_d->>'employee_loan_id', '')::uuid;
      if v_loan_id is not null then
        select l.amount - coalesce(sum(pd.amount), 0)
          into v_remaining
        from public.employee_loans l
        left join public.payroll_deductions pd on pd.employee_loan_id = l.id
        where l.id = v_loan_id and l.status = 'approved'
          and l.organization_id = public.current_org_id()
        group by l.amount;

        if v_remaining is null then
          raise exception 'Préstamo no válido para descuento';
        end if;
        if v_amount > v_remaining + 0.01 then
          raise exception 'La deducción excede el saldo del préstamo';
        end if;
      end if;
    end loop;
  end if;

  insert into public.payroll_payments (
    employee_id, payment_date, period, gross_amount,
    total_deductions, net_amount, receipt_url, notes, created_by
  ) values (
    p_employee_id, p_payment_date, p_period, coalesce(p_gross, 0),
    v_total_ded, coalesce(p_net, 0), p_receipt_url, p_notes, auth.uid()
  )
  returning id into v_payment_id;

  if p_deductions is not null then
    for v_d in select * from jsonb_array_elements(p_deductions)
    loop
      v_amount := coalesce((v_d->>'amount')::numeric, 0);
      if v_amount <= 0 then continue; end if;
      insert into public.payroll_deductions (
        payroll_payment_id, employee_loan_id, description, amount
      ) values (
        v_payment_id,
        nullif(v_d->>'employee_loan_id', '')::uuid,
        coalesce(v_d->>'description', ''),
        v_amount
      );
    end loop;
  end if;

  return v_payment_id;
end;
$$;

-- ── fn_daily_summary (filtra TODO por la org del usuario) ──────────────────
create or replace function public.fn_daily_summary(p_date date)
returns table (
  sales_cash             numeric,
  sales_card             numeric,
  sales_transfer         numeric,
  credit_sales           numeric,
  cp_cash                numeric,
  cp_card                numeric,
  cp_transfer            numeric,
  outflows_approved      numeric,
  outflows_pending       numeric,
  outflows_pending_count integer,
  supplier_payments_cash numeric,
  expected_cash          numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid := public.current_org_id();
  v_sc numeric; v_sd numeric; v_st numeric; v_cr numeric;
  v_pc numeric; v_pd numeric; v_pt numeric;
  v_oa numeric; v_op numeric; v_opc integer;
  v_spc numeric;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select
    coalesce(sum(total) filter (where payment_method = 'cash'), 0),
    coalesce(sum(total) filter (where payment_method = 'card'), 0),
    coalesce(sum(total) filter (where payment_method = 'transfer'), 0),
    coalesce(sum(total) filter (where payment_method = 'credit'), 0)
  into v_sc, v_sd, v_st, v_cr
  from public.sales
  where (created_at at time zone 'America/Bogota')::date = p_date
    and status <> 'cancelled'
    and organization_id = v_org;

  select
    coalesce(sum(amount) filter (where payment_method = 'cash'), 0),
    coalesce(sum(amount) filter (where payment_method = 'card'), 0),
    coalesce(sum(amount) filter (where payment_method = 'transfer'), 0)
  into v_pc, v_pd, v_pt
  from public.credit_payments
  where (created_at at time zone 'America/Bogota')::date = p_date
    and organization_id = v_org;

  select
    coalesce(sum(amount) filter (where status = 'approved'), 0),
    coalesce(sum(amount) filter (where status = 'pending'), 0),
    coalesce(count(*) filter (where status = 'pending'), 0)
  into v_oa, v_op, v_opc
  from public.cash_outflows
  where (created_at at time zone 'America/Bogota')::date = p_date
    and organization_id = v_org;

  select coalesce(sum(amount) filter (where payment_source = 'cash'), 0)
    into v_spc
  from public.supplier_payments
  where (created_at at time zone 'America/Bogota')::date = p_date
    and organization_id = v_org;

  return query select
    v_sc, v_sd, v_st, v_cr,
    v_pc, v_pd, v_pt,
    v_oa, v_op, v_opc,
    v_spc,
    (v_sc + v_pc - v_oa - v_spc)::numeric;
end;
$$;
