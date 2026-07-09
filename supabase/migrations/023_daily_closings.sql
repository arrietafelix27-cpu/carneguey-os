-- ============================================================================
-- 023 · Cuadre de caja (cierre del día)
-- ----------------------------------------------------------------------------
-- La app calcula todo lo que pasó en el día; la cajera solo confirma el
-- efectivo físico. Un cuadre por día (closing_date UNIQUE) e inmutable una vez
-- cerrado.
--
-- COLUMNAS EXTRA sobre el esquema propuesto: el flujo necesita guardar el
-- efectivo esperado, el contado, la diferencia, las notas y la hora de cierre.
-- Se agregan a daily_closings (la lista de categorías de daily_closing_items
-- queda tal cual se pidió).
--
-- EFECTIVO ESPERADO = ventas en efectivo + abonos en efectivo
--                     − egresos APROBADOS del día.
-- Los egresos pendientes NO restan (aún no están aprobados), pero se guardan
-- como dato informativo.
--
-- Todos los cortes de día usan la hora de Colombia (America/Bogota).
--
-- Regla de costos: la cajera no puede leer sales ni credit_payments (RLS
-- solo-admin). El resumen se calcula con fn_daily_summary (SECURITY DEFINER),
-- que devuelve únicamente los totales agregados que ella necesita para cuadrar.
-- ============================================================================

create table public.daily_closings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  created_by    uuid not null references public.profiles(id),
  closing_date  date not null unique,
  status        text not null default 'open' check (status in ('open', 'closed')),
  -- Extras necesarios para el flujo
  expected_cash numeric(12,2) not null default 0,
  counted_cash  numeric(12,2) not null default 0,
  difference    numeric(12,2) not null default 0,
  notes         text,
  closed_at     timestamptz
);

create table public.daily_closing_items (
  id                uuid primary key default gen_random_uuid(),
  daily_closing_id  uuid not null references public.daily_closings(id) on delete cascade,
  category          text not null check (category in (
                      'sales_cash', 'sales_card', 'sales_transfer',
                      'credit_sales', 'customer_payments_cash',
                      'customer_payments_card', 'customer_payments_transfer',
                      'cash_outflows_approved', 'cash_outflows_pending')),
  amount            numeric(12,2) not null default 0,
  notes             text
);

create index idx_daily_closings_date on public.daily_closings(closing_date);
create index idx_dci_closing on public.daily_closing_items(daily_closing_id);

-- ---- RLS ------------------------------------------------------------------
alter table public.daily_closings      enable row level security;
alter table public.daily_closing_items enable row level security;

-- Admin lee todo; la cajera solo el cuadre del día actual.
create policy dc_select on public.daily_closings
  for select using (
    public.is_admin()
    or closing_date = (now() at time zone 'America/Bogota')::date
  );

create policy dci_select on public.daily_closing_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.daily_closings d
      where d.id = daily_closing_id
        and d.closing_date = (now() at time zone 'America/Bogota')::date
    )
  );

-- Sin policies de escritura: el cierre lo hace fn_close_day (definer).
grant select on public.daily_closings      to authenticated;
grant select on public.daily_closing_items to authenticated;

-- ---- Resumen del día (definer: lee sales / credit_payments / egresos) ------
create or replace function public.fn_daily_summary(p_date date)
returns table (
  sales_cash        numeric,
  sales_card        numeric,
  sales_transfer    numeric,
  credit_sales      numeric,
  cp_cash           numeric,
  cp_card           numeric,
  cp_transfer       numeric,
  outflows_approved numeric,
  outflows_pending  numeric,
  expected_cash     numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sc numeric; v_sd numeric; v_st numeric; v_cr numeric;
  v_pc numeric; v_pd numeric; v_pt numeric;
  v_oa numeric; v_op numeric;
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
    coalesce(sum(amount) filter (where status = 'pending'), 0)
  into v_oa, v_op
  from public.cash_outflows
  where (created_at at time zone 'America/Bogota')::date = p_date;

  return query select
    v_sc, v_sd, v_st, v_cr,
    v_pc, v_pd, v_pt,
    v_oa, v_op,
    (v_sc + v_pc - v_oa)::numeric;
end;
$$;

grant execute on function public.fn_daily_summary to authenticated;

-- ---- Cerrar el día --------------------------------------------------------
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
  v_id  uuid;
  v_s   record;
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

  -- Congela el detalle por categoría.
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
