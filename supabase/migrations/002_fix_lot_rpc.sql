-- ============================================================================
-- 002 · fix: ambigüedad "column reference 'lot_code' is ambiguous"
-- ----------------------------------------------------------------------------
-- En fn_create_lot_carcass y fn_create_lot_live el RETURNS TABLE declara
-- columnas `lot_code` que colisionan con la columna real de purchase_lots
-- al usar RETURNING. Se califica la cláusula RETURNING con el nombre de
-- la tabla para resolver la ambigüedad. La firma y los parámetros se
-- mantienen idénticos: el cliente no cambia.
-- ============================================================================

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
  returning purchase_lots.id, purchase_lots.lot_code
  into v_id, v_code;

  return query select v_id, v_code;
end;
$$;

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
  returning purchase_lots.id, purchase_lots.lot_code
  into v_id, v_code;

  return query select v_id, v_code;
end;
$$;

grant execute on function public.fn_create_lot_live    to authenticated;
grant execute on function public.fn_create_lot_carcass to authenticated;
