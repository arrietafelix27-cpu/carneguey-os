-- ============================================================================
-- 027 · Crédito con proveedores nace de la compra + privacidad por proveedor
-- ----------------------------------------------------------------------------
-- Reemplaza la creación manual de facturas como único camino: ahora la cajera
-- elige "¿Cómo se paga?" (Contado/Crédito) al registrar una compra, y si es
-- crédito la factura en supplier_invoices se crea sola, vinculada a la compra
-- que la originó. El botón "Agregar factura" manual se conserva para deudas
-- que no vienen de una compra registrada en la app.
--
-- Privacidad en dos capas (ambas deben ser false para que la cajera vea algo):
--   - providers.is_private      → nueva. Oculta TODO el proveedor.
--   - supplier_invoices.is_private → ya existía (026). Oculta una factura puntual.
-- La tabla providers en sí sigue legible por cualquier activo (providers_select,
-- 001) porque la cajera necesita elegir CUALQUIER proveedor al comprar — la
-- privacidad solo aplica a la vista de deudas, no a la existencia del proveedor.
--
-- supplier_payments gana payment_source ('cash'/'owner_contribution'): de dónde
-- salió la plata del abono. payment_method (026: cash/card/transfer) se
-- conserva en el esquema pero deja de pedirse en el formulario — se guarda
-- siempre 'cash' (los proveedores de este negocio se pagan en efectivo, lo que
-- cambia es si es de la caja del día o del bolsillo de Félix).
-- ============================================================================

-- ---- Columnas nuevas -------------------------------------------------------
alter table public.providers
  add column if not exists is_private boolean not null default false;

alter table public.supplier_invoices
  add column if not exists purchase_lot_id   uuid references public.purchase_lots(id),
  add column if not exists direct_purchase_id uuid references public.direct_purchases(id);

alter table public.supplier_payments
  add column if not exists payment_source text not null default 'cash'
    check (payment_source in ('cash', 'owner_contribution'));

-- ---- RLS: la privacidad de providers también cierra las facturas/pagos ----
drop policy if exists si_select on public.supplier_invoices;
create policy si_select on public.supplier_invoices
  for select using (
    public.is_admin()
    or (
      is_private = false
      and public.is_active_user()
      and exists (
        select 1 from public.providers p
        where p.id = provider_id and p.is_private = false
      )
    )
  );

drop policy if exists sp_select on public.supplier_payments;
create policy sp_select on public.supplier_payments
  for select using (
    public.is_admin()
    or exists (
      select 1
      from public.supplier_invoices si
      join public.providers p on p.id = si.provider_id
      where si.id = supplier_invoice_id
        and si.is_private = false
        and p.is_private = false
    )
  );

-- ---- Saldo por proveedor: ahora también respeta providers.is_private ------
create or replace view public.v_supplier_balances as
select
  p.id as provider_id,
  coalesce(sum(
    greatest(si.amount - coalesce(pay.paid, 0), 0)
  ) filter (where si.status <> 'paid'), 0)::numeric(14,2) as pending_total
from public.providers p
left join public.supplier_invoices si
  on si.provider_id = p.id
 and (public.is_admin() or si.is_private = false)
left join (
  select supplier_invoice_id, sum(amount) as paid
  from public.supplier_payments
  group by supplier_invoice_id
) pay on pay.supplier_invoice_id = si.id
where public.is_admin() or p.is_private = false
group by p.id;

-- ---- fn_register_supplier_payment: payment_source en vez de payment_method
drop function if exists public.fn_register_supplier_payment(uuid, numeric, text, text);

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
  where id = p_invoice_id
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

grant execute on function public.fn_register_supplier_payment to authenticated;

-- ---- fn_create_lot_carcass: + forma de pago + fecha límite ----------------
drop function if exists public.fn_create_lot_carcass(
  text, uuid, int, numeric, numeric, numeric, date, text);

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

grant execute on function public.fn_create_lot_carcass to authenticated;

-- ---- fn_create_lot_live: + forma de pago + fecha límite -------------------
-- Ganado en pie lo crea Félix (admin-only) — aquí SÍ vive el costo real del
-- lote beef_live, aunque la cajera nunca toque esta pantalla. "Llegada de
-- canales" (cajera) no lleva forma de pago porque no tiene costo propio: solo
-- confirma que el animal ya se sacrificó y llegaron los canales.
drop function if exists public.fn_create_lot_live(
  uuid, int, numeric, numeric, numeric, numeric, numeric, numeric, date, text);

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

grant execute on function public.fn_create_lot_live to authenticated;

-- ---- fn_register_direct_purchase: + forma de pago + fecha límite ----------
drop function if exists public.fn_register_direct_purchase(uuid, date, jsonb, text);

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

grant execute on function public.fn_register_direct_purchase to authenticated;

-- ---- daily_closing_items: nueva categoría 'supplier_payments_cash' --------
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.daily_closing_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.daily_closing_items drop constraint %I', c);
  end loop;
end $$;

alter table public.daily_closing_items
  add constraint daily_closing_items_category_check
  check (category in (
    'sales_cash', 'sales_card', 'sales_transfer',
    'credit_sales', 'customer_payments_cash',
    'customer_payments_card', 'customer_payments_transfer',
    'cash_outflows_approved', 'cash_outflows_pending',
    'supplier_payments_cash'));

-- ---- fn_daily_summary: + supplier_payments_cash, resta de expected_cash ---
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

  select coalesce(sum(amount) filter (where payment_source = 'cash'), 0)
    into v_spc
  from public.supplier_payments
  where (created_at at time zone 'America/Bogota')::date = p_date;

  return query select
    v_sc, v_sd, v_st, v_cr,
    v_pc, v_pd, v_pt,
    v_oa, v_op, v_opc,
    v_spc,
    (v_sc + v_pc - v_oa - v_spc)::numeric;
end;
$$;

grant execute on function public.fn_daily_summary to authenticated;

-- ---- fn_close_day: congela también supplier_payments_cash -----------------
drop function if exists public.fn_close_day(date, numeric, text);

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
    (v_id, 'cash_outflows_pending',      v_s.outflows_pending),
    (v_id, 'supplier_payments_cash',     v_s.supplier_payments_cash);

  return v_id;
end;
$$;

grant execute on function public.fn_close_day to authenticated;
