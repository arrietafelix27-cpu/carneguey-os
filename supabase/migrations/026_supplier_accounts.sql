-- ============================================================================
-- 026 · Cuentas por pagar de proveedores (supplier_invoices, supplier_payments)
-- ----------------------------------------------------------------------------
-- Félix registra lo que se debe a cada proveedor (factura). Puede marcarla
-- is_private = true para que la cajera nunca la vea ni la pague (deudas
-- sensibles). Las facturas normales (is_private = false) la cajera las ve
-- y puede registrar el pago desde la pantalla del proveedor.
--
-- El status ('pending'/'partial'/'paid') es una columna almacenada que solo
-- se recalcula dentro de fn_register_supplier_payment (SECURITY DEFINER) —
-- la cajera nunca inserta pagos ni toca el status directo. Mismo patrón que
-- fn_create_employee_loan / fn_complete_sale (D-011 en DECISIONS.md).
-- ============================================================================

create table public.supplier_invoices (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  created_by   uuid not null references public.profiles(id),
  provider_id  uuid not null references public.providers(id),
  amount       numeric(12,2) not null check (amount > 0),
  due_date     date,
  description  text not null,
  status       text not null default 'pending' check (
                 status in ('pending', 'partial', 'paid')),
  is_private   boolean not null default false
);

create table public.supplier_payments (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  created_by          uuid not null references public.profiles(id),
  supplier_invoice_id uuid not null references public.supplier_invoices(id),
  amount              numeric(12,2) not null check (amount > 0),
  payment_method      text not null check (
                        payment_method in ('cash', 'card', 'transfer')),
  notes               text
);

create index idx_supplier_invoices_provider on public.supplier_invoices(provider_id);
create index idx_supplier_invoices_status   on public.supplier_invoices(status);
create index idx_supplier_payments_invoice  on public.supplier_payments(supplier_invoice_id);

-- ---- RLS --------------------------------------------------------------
alter table public.supplier_invoices enable row level security;
alter table public.supplier_payments enable row level security;

-- Facturas: admin ve y escribe todo. La cajera solo ve las no privadas
-- (crear/editar factura sigue siendo solo-admin: la cajera nunca inserta).
create policy si_select on public.supplier_invoices
  for select using (
    public.is_admin()
    or (is_private = false and public.is_active_user())
  );
create policy si_write_admin on public.supplier_invoices
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.supplier_invoices to authenticated;

-- Pagos: admin ve todos. La cajera solo ve pagos de facturas no privadas.
-- Sin policies de INSERT/UPDATE/DELETE: el único camino de escritura es
-- fn_register_supplier_payment (definer, más abajo).
create policy sp_select on public.supplier_payments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.supplier_invoices si
      where si.id = supplier_invoice_id
        and si.is_private = false
    )
  );

grant select on public.supplier_payments to authenticated;

-- ---- fn_register_supplier_payment: registra el pago y recalcula status ----
create or replace function public.fn_register_supplier_payment(
  p_invoice_id     uuid,
  p_amount         numeric,
  p_payment_method text,
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
  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Método de pago no permitido';
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
    supplier_invoice_id, amount, payment_method, notes, created_by
  ) values (
    p_invoice_id, p_amount, p_payment_method, p_notes, auth.uid()
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

-- ---- Saldo pendiente por proveedor (para el listado admin y cajera) -------
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
group by p.id;

grant select on public.v_supplier_balances to authenticated;
