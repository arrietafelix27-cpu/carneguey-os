-- ============================================================================
-- 039 · Anular y devolver ventas
-- ----------------------------------------------------------------------------
-- Hasta hoy una venta no se podía corregir: `sales.status` aceptaba 'returned'
-- y 'cancelled' y todo el resto de la app ya los respetaba (cuadre, saldos,
-- ventas del día), pero ninguna ruta de código las ponía en ese estado.
--
-- Decisiones de Félix (2026-08-27):
--  · ANULAR = la venta no debió existir. Reescribe el pasado, así que solo el
--    MISMO día y con el cuadre de ese día sin cerrar. Devuelve todo al
--    inventario y la venta sale del cuadre.
--  · DEVOLVER = la venta sí ocurrió; el cliente trajo el producto de vuelta
--    HOY. No reescribe el pasado: sale plata de la caja de hoy. Sin límite de
--    tiempo (un restaurante puede devolver algo de hace días) y puede ser
--    PARCIAL (devuelve el pollo, se queda la carne).
--  · Al devolver, la cajera elige si el producto VUELVE al inventario o se da
--    por perdido (pollo con mal olor no se revende).
--  · Si la venta fue a crédito, lo normal es BAJARLE LA DEUDA en vez de
--    entregarle efectivo — si nunca pagó, darle plata sería pagarle dos veces.
--  · Ambas son acciones delicadas (038): de fábrica piden aprobación del dueño.
--
-- Las dos viven en UNA tabla (`sale_adjustments`) porque comparten flujo:
-- se solicitan, se aprueban o rechazan, y al aprobarse tocan inventario y caja.
-- ============================================================================

-- ── 1. Tablas ──────────────────────────────────────────────────────────────
create table if not exists public.sale_adjustments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id()
                    references public.organizations(id),
  sale_id         uuid not null references public.sales(id),
  kind            text not null check (kind in ('void', 'return')),
  status          text not null default 'pending' check (
                    status in ('pending', 'approved', 'rejected')),
  reason          text,
  -- Solo para 'return': cómo se le devuelve la plata al cliente.
  --   cash        → sale efectivo de la caja de hoy
  --   credit_note → se le baja lo que debe (no sale plata)
  refund_method   text check (refund_method in ('cash', 'credit_note')),
  -- Solo para 'return': si el producto vuelve al inventario o se da por perdido.
  restock         boolean not null default true,
  total_amount    numeric(12,2) not null default 0 check (total_amount >= 0),
  requested_by    uuid not null references public.profiles(id),
  requested_at    timestamptz not null default now(),
  reviewed_by     uuid references public.profiles(id),
  reviewed_at     timestamptz,
  applied_at      timestamptz,
  -- Una anulación se pide una sola vez por venta; las devoluciones pueden ser
  -- varias (parciales) sobre la misma venta.
  constraint sale_adjustments_void_needs_no_refund check (
    kind = 'return' or refund_method is null)
);

create table if not exists public.sale_adjustment_items (
  id            uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.sale_adjustments(id)
                  on delete cascade,
  product_id    uuid not null references public.products(id),
  quantity      numeric(10,3) not null check (quantity > 0),
  unit_price    numeric(12,2) not null check (unit_price >= 0),
  total_price   numeric(12,2) not null check (total_price >= 0)
);

create index if not exists idx_sale_adj_sale   on public.sale_adjustments(sale_id);
create index if not exists idx_sale_adj_status on public.sale_adjustments(status);
create index if not exists idx_sale_adj_org    on public.sale_adjustments(organization_id);
create index if not exists idx_sale_adj_items  on public.sale_adjustment_items(adjustment_id);

-- Una sola anulación viva por venta (pendiente o aprobada).
create unique index if not exists uq_sale_adj_one_void
  on public.sale_adjustments(sale_id)
  where kind = 'void' and status in ('pending', 'approved');

-- ── 2. RLS ─────────────────────────────────────────────────────────────────
-- total_amount es dinero → SELECT solo admin, igual que sales/sale_items.
-- La cajera nunca lee estas tablas: solicita y consulta por funciones definer.
-- Toda escritura pasa por fn_* (definer), así que no hay policies de escritura.
alter table public.sale_adjustments      enable row level security;
alter table public.sale_adjustment_items enable row level security;

drop policy if exists sale_adj_select on public.sale_adjustments;
create policy sale_adj_select on public.sale_adjustments
  for select using (
    organization_id = public.current_org_id() and public.is_admin());

drop policy if exists sale_adj_items_select on public.sale_adjustment_items;
create policy sale_adj_items_select on public.sale_adjustment_items
  for select using (
    public.is_admin()
    and exists (select 1 from public.sale_adjustments a
                where a.id = adjustment_id
                  and a.organization_id = public.current_org_id()));

grant select on public.sale_adjustments      to authenticated;
grant select on public.sale_adjustment_items to authenticated;

-- ── 3. inventory_movements acepta el nuevo origen ──────────────────────────
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.inventory_movements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%reference_type%'
  loop
    execute format(
      'alter table public.inventory_movements drop constraint %I', c);
  end loop;
end $$;

alter table public.inventory_movements
  add constraint inventory_movements_reference_type_check
  check (reference_type in (
    'direct_purchase', 'desposte_item', 'adjustment', 'physical_count',
    'cut_transfer', 'sub_desposte', 'sale', 'sale_adjustment'));

-- ── 4. Cuánto se ha devuelto ya de cada línea de una venta ─────────────────
-- Evita devolver dos veces lo mismo. Cuenta solo lo aprobado o pendiente.
create or replace function public.fn_sale_returned_qty(
  p_sale_id    uuid,
  p_product_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(i.quantity), 0)
  from public.sale_adjustments a
  join public.sale_adjustment_items i on i.adjustment_id = a.id
  where a.sale_id = p_sale_id
    and a.organization_id = public.current_org_id()
    and a.kind = 'return'
    and a.status in ('pending', 'approved')
    and i.product_id = p_product_id;
$$;

-- ── 5. Aplicar el ajuste (interna: no valida permisos, solo ejecuta) ───────
create or replace function public._apply_sale_adjustment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_a    public.sale_adjustments;
  v_item record;
  v_avg  numeric;
begin
  select * into v_a from public.sale_adjustments
  where id = p_id and organization_id = public.current_org_id();
  if not found then
    raise exception 'Ajuste no encontrado';
  end if;

  if v_a.kind = 'void' then
    -- La venta entera se da por no ocurrida: sale del cuadre y del saldo del
    -- cliente (todas las vistas ya excluyen 'cancelled') y la mercancía vuelve.
    update public.sales set status = 'cancelled' where id = v_a.sale_id;

    for v_item in
      select si.product_id, si.quantity
      from public.sale_items si
      where si.sale_id = v_a.sale_id
    loop
      select coalesce(
               sum(case when quantity > 0 then quantity * unit_cost end)
                 / nullif(sum(case when quantity > 0 then quantity end), 0),
               0)
        into v_avg
      from public.inventory_movements
      where product_id = v_item.product_id
        and organization_id = public.current_org_id();

      insert into public.inventory_movements (
        product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, notes, created_by
      ) values (
        v_item.product_id, 'adjustment_in', v_item.quantity,
        round(coalesce(v_avg, 0), 4),
        'sale_adjustment', v_a.id,
        'Venta anulada — devuelto al inventario', auth.uid()
      );
    end loop;

  else -- 'return'
    -- La venta original NO se toca: ocurrió de verdad. Se marca 'returned'
    -- solo como señal visual; el dinero y el inventario se mueven aquí.
    -- 'returned' sigue contando en el cuadre del día original a propósito.
    update public.sales set status = 'returned'
    where id = v_a.sale_id and status = 'completed';

    if v_a.restock then
      for v_item in
        select i.product_id, i.quantity
        from public.sale_adjustment_items i
        where i.adjustment_id = v_a.id
      loop
        select coalesce(
                 sum(case when quantity > 0 then quantity * unit_cost end)
                   / nullif(sum(case when quantity > 0 then quantity end), 0),
                 0)
          into v_avg
        from public.inventory_movements
        where product_id = v_item.product_id
          and organization_id = public.current_org_id();

        insert into public.inventory_movements (
          product_id, movement_type, quantity, unit_cost,
          reference_type, reference_id, notes, created_by
        ) values (
          v_item.product_id, 'adjustment_in', v_item.quantity,
          round(coalesce(v_avg, 0), 4),
          'sale_adjustment', v_a.id,
          'Devolución — vuelve al inventario', auth.uid()
        );
      end loop;
    end if;
    -- Si restock = false el producto se da por perdido: no entra al
    -- inventario y la plata igual sale. La merma queda registrada por
    -- ausencia, que es justamente lo que el dueño quiere ver.
  end if;

  update public.sale_adjustments
     set status      = 'approved',
         reviewed_by = coalesce(reviewed_by, auth.uid()),
         reviewed_at = coalesce(reviewed_at, now()),
         applied_at  = now()
   where id = p_id;
end;
$$;

revoke all on function public._apply_sale_adjustment(uuid) from public;

-- ── 6. Solicitar una anulación o devolución ────────────────────────────────
create or replace function public.fn_request_sale_adjustment(
  p_sale_id       uuid,
  p_kind          text,
  p_reason        text,
  p_refund_method text,
  p_restock       boolean,
  p_items         jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale     public.sales;
  v_id       uuid;
  v_it       jsonb;
  v_pid      uuid;
  v_qty      numeric;
  v_sold     numeric;
  v_returned numeric;
  v_price    numeric;
  v_total    numeric := 0;
  v_today    date := (now() at time zone 'America/Bogota')::date;
  v_sale_day date;
  v_free     boolean;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_kind not in ('void', 'return') then
    raise exception 'Tipo de ajuste no válido';
  end if;

  select * into v_sale from public.sales
  where id = p_sale_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Venta no encontrada';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'Esta venta ya fue anulada';
  end if;

  v_sale_day := (v_sale.created_at at time zone 'America/Bogota')::date;

  -- El día de HOY no puede estar cerrado: tanto anular como devolver mueven
  -- la caja de hoy.
  if exists (select 1 from public.daily_closings
             where closing_date = v_today
               and status = 'closed'
               and organization_id = public.current_org_id()) then
    raise exception
      'El cuadre de caja de hoy ya está cerrado. No se pueden registrar anulaciones ni devoluciones.';
  end if;

  -- Anular y devolver no pueden convivir sobre la misma venta: anular
  -- devuelve TODO al inventario y borra la venta del cuadre, así que sumado a
  -- una devolución ya aplicada duplicaría inventario y plata.
  if p_kind = 'void' then
    if exists (select 1 from public.sale_adjustments
               where sale_id = p_sale_id
                 and organization_id = public.current_org_id()
                 and kind = 'return'
                 and status in ('pending', 'approved')) then
      raise exception
        'Esta venta ya tiene una devolución. No se puede anular: haz la devolución de lo que falte.';
    end if;
  else
    if exists (select 1 from public.sale_adjustments
               where sale_id = p_sale_id
                 and organization_id = public.current_org_id()
                 and kind = 'void'
                 and status = 'pending') then
      raise exception
        'Esta venta tiene una anulación esperando aprobación. Espera a que se resuelva.';
    end if;
  end if;

  if p_kind = 'void' then
    -- Anular reescribe el pasado: solo el mismo día.
    if v_sale_day <> v_today then
      raise exception
        'Solo se puede anular una venta el mismo día en que se hizo. Para una venta de otro día usa una devolución.';
    end if;

    select coalesce(sum(total_price), 0) into v_total
    from public.sale_items where sale_id = p_sale_id;
    v_free := public.fn_action_is_free('perm_void_sale');

    insert into public.sale_adjustments (
      sale_id, kind, reason, refund_method, restock,
      total_amount, requested_by
    ) values (
      p_sale_id, 'void', nullif(trim(coalesce(p_reason, '')), ''),
      null, true, v_total, auth.uid()
    )
    returning id into v_id;

  else -- 'return'
    if p_items is null or jsonb_array_length(p_items) = 0 then
      raise exception 'Elige al menos un producto para devolver';
    end if;
    if coalesce(p_refund_method, '') not in ('cash', 'credit_note') then
      raise exception 'Elige cómo se le devuelve la plata al cliente';
    end if;
    if p_refund_method = 'credit_note' and v_sale.customer_id is null then
      raise exception
        'No se le puede bajar la deuda a una venta sin cliente. Devuelve el efectivo.';
    end if;

    v_free := public.fn_action_is_free('perm_return_sale');

    insert into public.sale_adjustments (
      sale_id, kind, reason, refund_method, restock,
      total_amount, requested_by
    ) values (
      p_sale_id, 'return', nullif(trim(coalesce(p_reason, '')), ''),
      p_refund_method, coalesce(p_restock, true), 0, auth.uid()
    )
    returning id into v_id;

    for v_it in select * from jsonb_array_elements(p_items) loop
      v_pid := (v_it->>'product_id')::uuid;
      v_qty := (v_it->>'quantity')::numeric;
      if v_qty is null or v_qty <= 0 then
        raise exception 'La cantidad a devolver debe ser mayor a cero';
      end if;

      select quantity, unit_price into v_sold, v_price
      from public.sale_items
      where sale_id = p_sale_id and product_id = v_pid
      limit 1;
      if v_sold is null then
        raise exception 'Ese producto no está en la venta';
      end if;

      -- Lo ya devuelto antes NO se puede devolver otra vez.
      v_returned := public.fn_sale_returned_qty(p_sale_id, v_pid);
      if v_qty > v_sold - v_returned + 0.001 then
        raise exception
          'No se puede devolver más de lo que se vendió (vendido % · ya devuelto % · se piden %).',
          round(v_sold, 3), round(v_returned, 3), round(v_qty, 3);
      end if;

      insert into public.sale_adjustment_items (
        adjustment_id, product_id, quantity, unit_price, total_price
      ) values (
        v_id, v_pid, v_qty, v_price, round(v_price * v_qty, 2)
      );
      v_total := v_total + round(v_price * v_qty, 2);
    end loop;

    update public.sale_adjustments set total_amount = v_total where id = v_id;
  end if;

  -- Acción suelta (038): se aplica de una vez, sin esperar al dueño.
  if v_free then
    perform public._apply_sale_adjustment(v_id);
  end if;

  return v_id;
end;
$$;

-- ── 7. El dueño aprueba o rechaza ──────────────────────────────────────────
create or replace function public.fn_review_sale_adjustment(
  p_id      uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_a public.sale_adjustments;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if not public.is_admin() then
    raise exception 'Solo el administrador puede aprobar anulaciones y devoluciones';
  end if;

  select * into v_a from public.sale_adjustments
  where id = p_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Solicitud no encontrada';
  end if;
  if v_a.status <> 'pending' then
    raise exception 'Esta solicitud ya fue revisada';
  end if;

  if p_approve then
    perform public._apply_sale_adjustment(p_id);
  else
    update public.sale_adjustments
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id;
  end if;
end;
$$;

revoke all on function public.fn_request_sale_adjustment(uuid, text, text, text, boolean, jsonb) from public;
revoke all on function public.fn_review_sale_adjustment(uuid, boolean) from public;
revoke all on function public.fn_sale_returned_qty(uuid, uuid) from public;
grant execute on function public.fn_request_sale_adjustment(uuid, text, text, text, boolean, jsonb) to authenticated;
grant execute on function public.fn_review_sale_adjustment(uuid, boolean) to authenticated;
grant execute on function public.fn_sale_returned_qty(uuid, uuid) to authenticated;

-- ── 8. Saldos de clientes: las devoluciones "bajar deuda" restan ───────────
drop view if exists public.v_customer_balances cascade;
create view public.v_customer_balances as
select
  c.id as customer_id,
  coalesce(cr.credit_total, 0)::numeric(14,2)  as credit_total,
  coalesce(pa.paid_total, 0)::numeric(14,2)    as paid_total,
  coalesce(rt.return_total, 0)::numeric(14,2)  as return_total,
  (coalesce(cr.credit_total, 0)
     - coalesce(pa.paid_total, 0)
     - coalesce(rt.return_total, 0))::numeric(14,2) as balance
from public.customers c
left join (
  select customer_id, sum(total) as credit_total
  from public.sales
  where payment_method = 'credit' and status <> 'cancelled'
  group by customer_id
) cr on cr.customer_id = c.id
left join (
  select customer_id, sum(amount) as paid_total
  from public.credit_payments
  group by customer_id
) pa on pa.customer_id = c.id
left join (
  select s.customer_id, sum(a.total_amount) as return_total
  from public.sale_adjustments a
  join public.sales s on s.id = a.sale_id
  where a.kind = 'return'
    and a.status = 'approved'
    and a.refund_method = 'credit_note'
    and s.status <> 'cancelled'
  group by s.customer_id
) rt on rt.customer_id = c.id
where public.is_admin()
  and c.organization_id = public.current_org_id();
grant select on public.v_customer_balances to authenticated;

drop view if exists public.v_pos_customer_balances cascade;
create view public.v_pos_customer_balances as
select
  c.id,
  c.name,
  c.phone,
  (coalesce(cr.credit_total, 0)
     - coalesce(pa.paid_total, 0)
     - coalesce(rt.return_total, 0))::numeric(14,2) as balance
from public.customers c
left join (
  select customer_id, sum(total) as credit_total
  from public.sales
  where payment_method = 'credit' and status <> 'cancelled'
  group by customer_id
) cr on cr.customer_id = c.id
left join (
  select customer_id, sum(amount) as paid_total
  from public.credit_payments
  group by customer_id
) pa on pa.customer_id = c.id
left join (
  select s.customer_id, sum(a.total_amount) as return_total
  from public.sale_adjustments a
  join public.sales s on s.id = a.sale_id
  where a.kind = 'return'
    and a.status = 'approved'
    and a.refund_method = 'credit_note'
    and s.status <> 'cancelled'
  group by s.customer_id
) rt on rt.customer_id = c.id
where c.active = true
  and public.is_active_user()
  and c.organization_id = public.current_org_id();
grant select on public.v_pos_customer_balances to authenticated;

-- ── 9. Cuadre de caja: las devoluciones en efectivo salen de la caja de hoy ─
alter table public.daily_closing_items
  drop constraint if exists daily_closing_items_category_check;
alter table public.daily_closing_items
  add constraint daily_closing_items_category_check
  check (category in (
    'sales_cash', 'sales_card', 'sales_transfer',
    'credit_sales', 'customer_payments_cash',
    'customer_payments_card', 'customer_payments_transfer',
    'cash_outflows_approved', 'cash_outflows_pending',
    'supplier_payments_cash', 'sale_returns_cash'));

-- Sin cascade a propósito: si algo dependiera de la firma vieja, preferimos
-- que la migración falle a que se borre en silencio.
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
  supplier_payments_cash numeric,
  returns_cash           numeric,
  adjustments_pending_count integer,
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
  v_rc numeric; v_apc integer;
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

  -- Devoluciones en efectivo APROBADAS del día: salen de la caja de hoy,
  -- aunque la venta original haya sido de otro día.
  -- Las pendientes no restan (todavía no ha salido plata), pero se cuentan
  -- para bloquear el cierre, igual que los egresos pendientes.
  select
    coalesce(sum(total_amount) filter (
      where status = 'approved' and kind = 'return'
        and refund_method = 'cash'
        and (applied_at at time zone 'America/Bogota')::date = p_date), 0),
    coalesce(count(*) filter (
      where status = 'pending'
        and (requested_at at time zone 'America/Bogota')::date = p_date), 0)
  into v_rc, v_apc
  from public.sale_adjustments
  where organization_id = v_org;

  return query select
    v_sc, v_sd, v_st, v_cr,
    v_pc, v_pd, v_pt,
    v_oa, v_op, v_opc,
    v_spc,
    v_rc, v_apc,
    (v_sc + v_pc - v_oa - v_spc - v_rc)::numeric;
end;
$$;

grant execute on function public.fn_daily_summary(date) to authenticated;

-- ── 10. fn_close_day: bloquea si hay anulaciones/devoluciones pendientes ────
create or replace function public.fn_close_day(
  p_date         date,
  p_counted_cash numeric,
  p_notes        text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s record;
  v_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_s from public.fn_daily_summary(p_date);

  if v_s.outflows_pending_count > 0 then
    raise exception
      'No se puede cerrar el día: hay % egreso(s) pendiente(s) de aprobación',
      v_s.outflows_pending_count;
  end if;

  if v_s.adjustments_pending_count > 0 then
    raise exception
      'No se puede cerrar el día: hay % anulación(es) o devolución(es) esperando tu aprobación',
      v_s.adjustments_pending_count;
  end if;

  insert into public.daily_closings (
    created_by, closing_date, status,
    expected_cash, counted_cash, difference, notes, closed_at
  ) values (
    auth.uid(), p_date, 'closed',
    v_s.expected_cash, p_counted_cash,
    (p_counted_cash - v_s.expected_cash), p_notes, now()
  )
  on conflict (organization_id, closing_date) do update
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
    (v_id, 'cash_outflows_pending',      v_s.outflows_pending),
    (v_id, 'supplier_payments_cash',     v_s.supplier_payments_cash),
    (v_id, 'sale_returns_cash',          v_s.returns_cash);

  return v_id;
end;
$$;

grant execute on function public.fn_close_day(date, numeric, text) to authenticated;

-- ── 11. La cajera necesita ver la venta que quiere corregir ────────────────
-- sales/sale_items son solo-admin. Esta función definer le entrega a la cajera
-- únicamente lo necesario para pedir la corrección de UNA venta concreta:
-- qué productos, cuánto se vendió y cuánto ya se devolvió. Sin costos ni
-- márgenes — solo el precio al que se le vendió al cliente, que ella ya vio.
create or replace function public.fn_sale_for_adjustment(p_sale_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale  public.sales;
  v_items jsonb;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_sale from public.sales
  where id = p_sale_id and organization_id = public.current_org_id();
  if not found then
    raise exception 'Venta no encontrada';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_id',   si.product_id,
           'name',         p.name,
           'unit',         p.unit,
           'quantity',     si.quantity,
           'unit_price',   si.unit_price,
           'total_price',  si.total_price,
           'returned_qty', public.fn_sale_returned_qty(p_sale_id, si.product_id)
         ) order by p.name), '[]'::jsonb)
    into v_items
  from public.sale_items si
  join public.products p on p.id = si.product_id
  where si.sale_id = p_sale_id;

  return jsonb_build_object(
    'id',             v_sale.id,
    'created_at',     v_sale.created_at,
    'payment_method', v_sale.payment_method,
    'customer_id',    v_sale.customer_id,
    'total',          v_sale.total,
    'status',         v_sale.status,
    'same_day',       (v_sale.created_at at time zone 'America/Bogota')::date
                        = (now() at time zone 'America/Bogota')::date,
    'items',          v_items
  );
end;
$$;

revoke all on function public.fn_sale_for_adjustment(uuid) from public;
grant execute on function public.fn_sale_for_adjustment(uuid) to authenticated;
