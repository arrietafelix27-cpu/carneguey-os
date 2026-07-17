-- ============================================================================
-- 025 · Lectura de ventas del día para la cajera (Pantalla "Ventas del día")
-- ----------------------------------------------------------------------------
-- sales/sale_items tienen SELECT solo-admin desde la 019 (dinero). La cajera
-- necesita ver las ventas de HOY para su propia pantalla de control — no es
-- costo ni margen, es el mismo total que ella ya cobró en el POS.
--
-- Mismo patrón que v_pos_products / v_pos_customers (migraciones 019/020):
-- vistas normales (corren con privilegios del dueño, no heredan la RLS de
-- sales/sale_items) que exponen solo columnas de venta, nunca unit_cost.
-- ============================================================================

create or replace view public.v_pos_sales_today as
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
  and public.is_active_user();

grant select on public.v_pos_sales_today to authenticated;

create or replace view public.v_pos_sale_items_today as
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
  and si.sale_id in (select id from public.v_pos_sales_today);

grant select on public.v_pos_sale_items_today to authenticated;
