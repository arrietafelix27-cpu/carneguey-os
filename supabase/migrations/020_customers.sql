-- ============================================================================
-- 020 · POS Fase 2 — clientes, descuentos y ventas a crédito
-- ----------------------------------------------------------------------------
-- Regla de costos: customers, sales y credit_payments tienen datos sensibles
-- (credit_limit, notas, montos). SELECT de esas tablas es SOLO-ADMIN. La
-- cajera lee clientes activos por la vista v_pos_customers (definer), que NO
-- expone credit_limit ni notas — solo lo operativo del POS (nombre, teléfono,
-- tipo y valor del descuento, necesarios para aplicarlo en la venta).
-- ============================================================================

-- ---- Clientes -------------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null,
  phone          text,
  discount_type  text check (
                   discount_type in ('percentage', 'fixed_per_product')),
  discount_value numeric(12,2) not null default 0 check (discount_value >= 0),
  credit_limit   numeric(12,2) not null default 0 check (credit_limit >= 0),
  active          boolean not null default true,
  notes          text
);

create index idx_customers_active on public.customers(active);

alter table public.customers enable row level security;

-- SELECT de la tabla base: solo admin (tiene credit_limit y notas).
create policy customers_select_admin on public.customers
  for select using (public.is_admin());
create policy customers_write_admin on public.customers
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.customers to authenticated;

-- Vista para el POS (cajera): clientes activos, sin credit_limit ni notas.
create or replace view public.v_pos_customers as
select id, name, phone, discount_type, discount_value
from public.customers
where active = true and public.is_active_user();

grant select on public.v_pos_customers to authenticated;

-- ---- Ajustes a sales ------------------------------------------------------
alter table public.sales
  add column if not exists discount_total numeric(12,2) not null default 0;

-- FK de customer_id (la columna ya existía desde 019, sin FK).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sales_customer_id_fkey'
      and conrelid = 'public.sales'::regclass
  ) then
    alter table public.sales
      add constraint sales_customer_id_fkey
      foreign key (customer_id) references public.customers(id);
  end if;
end $$;

-- status admite 'credit_pending'.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.sales'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.sales drop constraint %I', c);
  end loop;
end $$;

alter table public.sales
  add constraint sales_status_check
  check (status in ('completed', 'credit_pending', 'returned', 'cancelled'));

-- ---- Abonos a crédito -----------------------------------------------------
create table public.credit_payments (
  id             uuid primary key default gen_random_uuid(),
  sale_id        uuid references public.sales(id),
  customer_id    uuid not null references public.customers(id),
  amount         numeric(12,2) not null check (amount > 0),
  payment_method text not null check (
                   payment_method in ('cash', 'card', 'transfer')),
  created_at     timestamptz not null default now(),
  created_by     uuid not null references public.profiles(id)
);

create index idx_credit_payments_customer on public.credit_payments(customer_id);
create index idx_credit_payments_sale     on public.credit_payments(sale_id);

alter table public.credit_payments enable row level security;

-- Dinero → SELECT solo admin. La cajera puede INSERTAR abonos pero no leer
-- montos históricos.
create policy cp_select_admin on public.credit_payments
  for select using (public.is_admin());
create policy cp_insert on public.credit_payments
  for insert with check (
    created_by = auth.uid() and public.is_active_user());

grant select, insert on public.credit_payments to authenticated;

-- ---- Saldo de crédito por cliente (solo admin) ----------------------------
create or replace view public.v_customer_balances as
select
  c.id as customer_id,
  coalesce(cr.credit_total, 0)::numeric(14,2)  as credit_total,
  coalesce(pa.paid_total, 0)::numeric(14,2)    as paid_total,
  (coalesce(cr.credit_total, 0) - coalesce(pa.paid_total, 0))::numeric(14,2)
    as balance
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
where public.is_admin();

grant select on public.v_customer_balances to authenticated;

-- ---- fn_complete_sale (nueva firma: cliente + descuento + crédito) --------
drop function if exists public.fn_complete_sale(
  text, numeric, numeric, numeric, numeric, jsonb);

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
    where product_id = v_pid;

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

grant execute on function public.fn_complete_sale to authenticated;
