-- ============================================================================
-- 021 · Módulo de clientes para la cajera + índice para el cuadre del día
-- ----------------------------------------------------------------------------
-- La cajera debe poder ver el saldo pendiente de cada cliente activo y
-- registrar abonos desde el PC del negocio.
--
-- Regla de costos: se expone SOLO lo operativo para cobrar (nombre, teléfono y
-- saldo). NO se expone cupo de crédito, notas, descuentos ni el detalle
-- financiero (comprado a crédito / abonado), que siguen en la vista solo-admin
-- v_customer_balances.
--
-- credit_payments (creada en 020) ya tiene la estructura correcta para el
-- cuadre del día: sale_id NULLABLE (un abono puede ir contra el saldo general
-- del cliente y no contra una venta específica), customer_id, amount,
-- payment_method ('cash'/'card'/'transfer'), created_at y created_by.
-- Solo se agrega un índice por fecha para las consultas del cuadre diario.
-- ============================================================================

-- Índice para el cuadre del día (abonos por fecha).
create index if not exists idx_credit_payments_created_at
  on public.credit_payments(created_at);

-- Vista para la cajera: clientes activos con su saldo pendiente.
-- Definer (corre como owner): puede leer sales y credit_payments, cuya RLS es
-- solo-admin, pero solo devuelve las columnas operativas.
create or replace view public.v_pos_customer_balances as
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
  and public.is_active_user();

grant select on public.v_pos_customer_balances to authenticated;
