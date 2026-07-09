-- ============================================================================
-- 024 · El día no se puede cerrar con egresos pendientes de aprobación
-- ----------------------------------------------------------------------------
-- 1. fn_daily_summary ahora devuelve además outflows_pending_count. La cajera
--    solo ve SUS egresos por RLS, así que necesita esta función (definer) para
--    saber cuántos pendientes hay en total en el día — incluidos los de otra
--    persona — y entender por qué no puede cerrar.
--
-- 2. fn_close_day rechaza el cierre si queda algún egreso pendiente. Se valida
--    en la base (no solo en la UI) para que no se pueda saltar.
--
-- Los egresos pendientes siguen SIN restar del efectivo esperado: como no están
-- aprobados, oficialmente no han salido de caja.
-- ============================================================================

-- El tipo de retorno cambia → hay que borrar y recrear.
drop function if exists public.fn_daily_summary(date);

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
  expected_cash          numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sc numeric; v_sd numeric; v_st numeric; v_cr numeric;
  v_pc numeric; v_pd numeric; v_pt numeric;
  v_oa numeric; v_op numeric; v_opc integer;
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
    and status <> 'cancelled';

  select
    coalesce(sum(amount) filter (where payment_method = 'cash'), 0),
    coalesce(sum(amount) filter (where payment_method = 'card'), 0),
    coalesce(sum(amount) filter (where payment_method = 'transfer'), 0)
  into v_pc, v_pd, v_pt
  from public.credit_payments
  where (created_at at time zone 'America/Bogota')::date = p_date;

  select
    coalesce(sum(amount) filter (where status = 'approved'), 0),
    coalesce(sum(amount) filter (where status = 'pending'), 0),
    coalesce(count(*) filter (where status = 'pending'), 0)
  into v_oa, v_op, v_opc
  from public.cash_outflows
  where (created_at at time zone 'America/Bogota')::date = p_date;

  return query select
    v_sc, v_sd, v_st, v_cr,
    v_pc, v_pd, v_pt,
    v_oa, v_op, v_opc,
    (v_sc + v_pc - v_oa)::numeric;
end;
$$;

grant execute on function public.fn_daily_summary to authenticated;

-- ---- Cerrar el día: bloqueado si hay egresos pendientes -------------------
create or replace function public.fn_close_day(
  p_date         date,
  p_counted_cash numeric,
  p_notes        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_s  record;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'El efectivo contado no es válido';
  end if;

  if exists (
    select 1 from public.daily_closings
    where closing_date = p_date and status = 'closed'
  ) then
    raise exception 'El día % ya fue cerrado', p_date;
  end if;

  select * into v_s from public.fn_daily_summary(p_date);

  if v_s.outflows_pending_count > 0 then
    raise exception
      'No se puede cerrar el día: hay % egreso(s) pendiente(s) de aprobación',
      v_s.outflows_pending_count;
  end if;

  insert into public.daily_closings (
    created_by, closing_date, status,
    expected_cash, counted_cash, difference, notes, closed_at
  ) values (
    auth.uid(), p_date, 'closed',
    v_s.expected_cash, p_counted_cash,
    (p_counted_cash - v_s.expected_cash), p_notes, now()
  )
  on conflict (closing_date) do update
    set status        = 'closed',
        created_by    = auth.uid(),
        expected_cash = excluded.expected_cash,
        counted_cash  = excluded.counted_cash,
        difference    = excluded.difference,
        notes         = excluded.notes,
        closed_at     = now()
  returning id into v_id;

  delete from public.daily_closing_items where daily_closing_id = v_id;

  insert into public.daily_closing_items (daily_closing_id, category, amount)
  values
    (v_id, 'sales_cash',                 v_s.sales_cash),
    (v_id, 'sales_card',                 v_s.sales_card),
    (v_id, 'sales_transfer',             v_s.sales_transfer),
    (v_id, 'credit_sales',               v_s.credit_sales),
    (v_id, 'customer_payments_cash',     v_s.cp_cash),
    (v_id, 'customer_payments_card',     v_s.cp_card),
    (v_id, 'customer_payments_transfer', v_s.cp_transfer),
    (v_id, 'cash_outflows_approved',     v_s.outflows_approved),
    (v_id, 'cash_outflows_pending',      v_s.outflows_pending);

  return v_id;
end;
$$;

grant execute on function public.fn_close_day to authenticated;
