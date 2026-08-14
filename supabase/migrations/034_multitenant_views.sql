-- ============================================================================
-- 034 · Aislamiento de las vistas por organización (Fase 1)
-- ----------------------------------------------------------------------------
-- Las vistas corren como owner (BYPASSRLS) a propósito: exponen a la cajera
-- columnas (precio de venta, saldos) cuya RLS le niega el SELECT, sin darle
-- acceso al dinero. Ese propósito NO cambia. Faltaba filtrar por organización:
-- sin el filtro, una vista owner devuelve filas de TODOS los negocios.
--
-- Se usa DROP VIEW ... CASCADE + CREATE VIEW (en vez de create or replace)
-- porque algunas vistas reales en la BD tienen distinto orden/nombre de
-- columnas que el repo (p. ej. v_monthly_payroll y v_employees_active se
-- crearon a mano y nunca se versionaron), y create-or-replace no admite
-- cambiar columnas. El drop+create las deja idénticas al repo.
--
-- CASCADE: la única dependencia entre vistas es v_pos_sale_items_today →
-- v_pos_sales_today; ambas se recrean aquí. Ninguna función ni tabla depende
-- de estas vistas, así que cascade no arrastra nada más.
--
-- Como el drop borra los GRANT, se vuelve a dar "grant select ... authenticated"
-- después de cada vista.
-- ============================================================================

-- ── Drops (dependiente primero) ────────────────────────────────────────────
drop view if exists public.v_pos_sale_items_today          cascade;
drop view if exists public.v_pos_sales_today               cascade;
drop view if exists public.v_purchase_lots_employee        cascade;
drop view if exists public.v_direct_purchases_employee     cascade;
drop view if exists public.v_inventory_movements_employee  cascade;
drop view if exists public.v_current_inventory_employee    cascade;
drop view if exists public.v_physical_count_items_employee cascade;
drop view if exists public.v_physical_count_items_admin    cascade;
drop view if exists public.v_products_admin                cascade;
drop view if exists public.v_pos_products                  cascade;
drop view if exists public.v_pos_customers                 cascade;
drop view if exists public.v_customer_balances             cascade;
drop view if exists public.v_pos_customer_balances         cascade;
drop view if exists public.v_supplier_balances             cascade;
drop view if exists public.v_employees_active              cascade;
drop view if exists public.v_monthly_payroll               cascade;
drop view if exists public.v_current_inventory             cascade;
drop view if exists public.v_lot_summary                   cascade;
drop view if exists public.v_desposte_summary              cascade;

-- ── Vistas de EMPLEADO (owner, sin dinero) ─────────────────────────────────
create view public.v_purchase_lots_employee as
select
  id, lot_code, type, provider_id, status,
  live_animal_count, live_weight_kg, live_purchase_date,
  carcass_count, carcass_weight_kg, arrival_date,
  notes, created_by, created_at, activated_by, activated_at, closed_at
from public.purchase_lots
where organization_id = public.current_org_id();
grant select on public.v_purchase_lots_employee to authenticated;

create view public.v_direct_purchases_employee as
select
  id, provider_id, product_id, quantity, purchase_date,
  notes, created_by, created_at
from public.direct_purchases
where organization_id = public.current_org_id();
grant select on public.v_direct_purchases_employee to authenticated;

create view public.v_inventory_movements_employee as
select
  id, product_id, movement_type, quantity,
  reference_type, reference_id, notes, created_by, created_at
from public.inventory_movements
where organization_id = public.current_org_id();
grant select on public.v_inventory_movements_employee to authenticated;

create view public.v_current_inventory_employee as
select
  p.id        as product_id,
  p.name      as product_name,
  p.category,
  p.unit,
  p.active,
  coalesce(sum(m.quantity), 0)::numeric(12,2) as quantity_in_stock
from public.products p
left join public.inventory_movements m on m.product_id = p.id
where p.organization_id = public.current_org_id()
group by p.id;
grant select on public.v_current_inventory_employee to authenticated;

create view public.v_physical_count_items_employee as
select
  i.id, i.physical_count_id, i.product_id,
  p.name as product_name, p.category, p.unit,
  i.physical_quantity, i.notes, i.created_at
from public.physical_count_items i
join public.products p on p.id = i.product_id
where i.organization_id = public.current_org_id();
grant select on public.v_physical_count_items_employee to authenticated;

-- ── Vista de conteo SOLO admin (owner + is_admin) ──────────────────────────
create view public.v_physical_count_items_admin as
select
  i.id,
  i.physical_count_id,
  i.product_id,
  p.name      as product_name,
  p.category,
  p.unit,
  i.theoretical_quantity,
  i.physical_quantity,
  i.actual_quantity,
  i.notes,
  i.created_at
from public.physical_count_items i
join public.products p on p.id = i.product_id
where public.is_admin()
  and i.organization_id = public.current_org_id();
grant select on public.v_physical_count_items_admin to authenticated;

-- ── Catálogo admin con precio (owner + is_admin) ───────────────────────────
create view public.v_products_admin as
select
  id, pos_code, name, category, unit, origin,
  active, shared_across_species, price, created_at
from public.products
where public.is_admin()
  and organization_id = public.current_org_id();
grant select on public.v_products_admin to authenticated;

-- ── POS: productos con precio de venta (owner, cajera) ─────────────────────
create view public.v_pos_products as
select
  p.id, p.pos_code, p.name, p.category, p.unit, p.price
from public.products p
where p.active = true
  and public.is_active_user()
  and p.organization_id = public.current_org_id();
grant select on public.v_pos_products to authenticated;

-- ── POS: clientes (owner, cajera) ──────────────────────────────────────────
create view public.v_pos_customers as
select id, name, phone, discount_type, discount_value
from public.customers
where active = true
  and public.is_active_user()
  and organization_id = public.current_org_id();
grant select on public.v_pos_customers to authenticated;

-- ── Saldos de clientes SOLO admin (owner + is_admin) ───────────────────────
create view public.v_customer_balances as
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
where public.is_admin()
  and c.organization_id = public.current_org_id();
grant select on public.v_customer_balances to authenticated;

-- ── POS: saldos de clientes para la cajera (owner) ─────────────────────────
create view public.v_pos_customer_balances as
select
  c.id,
  c.name,
  c.phone,
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
where c.active = true
  and public.is_active_user()
  and c.organization_id = public.current_org_id();
grant select on public.v_pos_customer_balances to authenticated;

-- ── POS: ventas del día (owner, cajera) ── v_pos_sales_today ANTES de items ─
create view public.v_pos_sales_today as
select
  s.id,
  s.created_at,
  s.payment_method,
  s.subtotal,
  s.discount_total,
  s.total,
  s.status
from public.sales s
where (s.created_at at time zone 'America/Bogota')::date
      = (now() at time zone 'America/Bogota')::date
  and s.status <> 'cancelled'
  and public.is_active_user()
  and s.organization_id = public.current_org_id();
grant select on public.v_pos_sales_today to authenticated;

create view public.v_pos_sale_items_today as
select
  si.id,
  si.sale_id,
  si.product_id,
  p.name as product_name,
  p.unit,
  si.quantity,
  si.unit_price,
  si.total_price
from public.sale_items si
join public.products p on p.id = si.product_id
where public.is_active_user()
  and si.organization_id = public.current_org_id()
  and si.sale_id in (select id from public.v_pos_sales_today);
grant select on public.v_pos_sale_items_today to authenticated;

-- ── Saldos de proveedores (owner) ──────────────────────────────────────────
create view public.v_supplier_balances as
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
where (public.is_admin() or p.is_private = false)
  and p.organization_id = public.current_org_id()
group by p.id;
grant select on public.v_supplier_balances to authenticated;

-- ── Nómina: empleados activos (owner, para el dropdown de la cajera) ───────
create view public.v_employees_active as
select id, name
from public.employees
where active = true
  and public.is_active_user()
  and organization_id = public.current_org_id();
grant select on public.v_employees_active to authenticated;

-- ── Nómina: resumen mensual SOLO admin (owner + is_admin) ──────────────────
create view public.v_monthly_payroll as
select
  p.employee_id,
  e.name                                     as employee_name,
  date_trunc('month', p.payment_date)::date  as month,
  count(*)                                   as payments,
  sum(p.gross_amount)::numeric(14,2)         as gross_total,
  sum(p.total_deductions)::numeric(14,2)     as deductions_total,
  sum(p.net_amount)::numeric(14,2)           as net_total
from public.payroll_payments p
join public.employees e on e.id = p.employee_id
where public.is_admin()
  and p.organization_id = public.current_org_id()
group by p.employee_id, e.name, date_trunc('month', p.payment_date);
grant select on public.v_monthly_payroll to authenticated;

-- ── Vistas security_invoker (ya respetaban RLS; filtro como defensa extra) ─
create view public.v_current_inventory
with (security_invoker = on) as
with agg as (
  select
    p.id        as product_id,
    p.name      as product_name,
    p.category,
    p.unit,
    p.active,
    coalesce(sum(m.quantity), 0) as quantity_in_stock,
    coalesce(
      sum(case when m.quantity > 0 then m.quantity * m.unit_cost end)
        / nullif(sum(case when m.quantity > 0 then m.quantity end), 0),
      0
    ) as weighted_avg_unit_cost
  from public.products p
  left join public.inventory_movements m on m.product_id = p.id
  where p.organization_id = public.current_org_id()
  group by p.id
)
select
  product_id,
  product_name,
  category,
  unit,
  active,
  round(quantity_in_stock, 2)::numeric(12,2)                        as quantity_in_stock,
  round(weighted_avg_unit_cost, 4)::numeric(12,4)                   as weighted_avg_unit_cost,
  round(quantity_in_stock * weighted_avg_unit_cost, 2)::numeric(14,2) as total_value
from agg;
grant select on public.v_current_inventory to authenticated;

create view public.v_lot_summary
with (security_invoker = on) as
with d as (
  select
    lot_id,
    count(*) filter (where status = 'finalized')                        as finalized_desposte_count,
    coalesce(sum(input_weight_kg) filter (where status = 'finalized'), 0) as kg_despostado
  from public.despostes
  group by lot_id
),
base as (
  select
    l.*,
    case
      when l.type = 'beef_live' then
        coalesce(l.live_purchase_cost, 0)
        + l.transport_to_slaughter_cost
        + l.slaughter_cost
        + l.transport_to_shop_cost
        + l.other_costs
      when l.type in ('beef_carcass', 'pork_carcass') then
        coalesce(l.carcass_purchase_cost, 0)
        + l.carcass_transport_cost
      else 0
    end as total_cost
  from public.purchase_lots l
  where l.organization_id = public.current_org_id()
)
select
  b.id                as lot_id,
  b.lot_code,
  b.type,
  b.status,
  b.provider_id,
  b.live_weight_kg,
  b.carcass_weight_kg,
  b.carcass_count,
  b.arrival_date,
  b.created_at,
  round(b.total_cost, 2)::numeric(14,2)                                  as total_cost,
  round(b.total_cost / nullif(b.carcass_weight_kg, 0), 4)::numeric(12,4)  as cost_per_kg_carcass,
  case when b.type = 'beef_live'
       then round(b.carcass_weight_kg / nullif(b.live_weight_kg, 0) * 100, 2)::numeric(6,2)
  end                                                                    as slaughter_yield_pct,
  coalesce(d.kg_despostado, 0)::numeric(12,2)                            as kg_despostado,
  round(coalesce(b.carcass_weight_kg, 0) - coalesce(d.kg_despostado, 0), 2)::numeric(12,2) as kg_remaining,
  coalesce(d.finalized_desposte_count, 0)                                as finalized_desposte_count
from base b
left join d on d.lot_id = b.id;
grant select on public.v_lot_summary to authenticated;

create view public.v_desposte_summary
with (security_invoker = on) as
select
  d.id              as desposte_id,
  d.lot_id,
  d.status,
  d.desposte_date,
  d.input_weight_kg,
  d.created_at,
  d.finalized_at,
  coalesce(sum(i.weight_kg), 0)::numeric(12,2)                              as total_output_kg,
  round(d.input_weight_kg - coalesce(sum(i.weight_kg), 0), 2)::numeric(12,2) as merma_kg,
  round(
    (d.input_weight_kg - coalesce(sum(i.weight_kg), 0))
      / nullif(d.input_weight_kg, 0) * 100, 2
  )::numeric(6,2)                                                           as merma_pct,
  count(i.id)                                                               as item_count
from public.despostes d
left join public.desposte_items i on i.desposte_id = d.id
where d.organization_id = public.current_org_id()
group by d.id;
grant select on public.v_desposte_summary to authenticated;
