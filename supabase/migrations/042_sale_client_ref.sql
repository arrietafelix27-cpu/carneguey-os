-- ============================================================================
-- 042 · POS sin internet — evitar ventas duplicadas al sincronizar
-- ----------------------------------------------------------------------------
-- Decisión D-022 (opción B): si el POS ya está abierto y se cae la conexión,
-- sigue vendiendo y guarda las ventas en el computador; las manda solas
-- cuando vuelve la señal.
--
-- El peligro real de eso NO es perder ventas, es DUPLICARLAS: el POS manda la
-- venta, la red se corta antes de recibir la respuesta, el POS cree que falló
-- y la vuelve a mandar. Resultado: la misma carne cobrada dos veces y
-- descontada dos veces del inventario.
--
-- Solución: cada venta lleva un identificador único generado en el computador
-- ANTES de intentar mandarla (`client_ref`). Si llega dos veces, la segunda no
-- crea nada — devuelve el id de la que ya existe. Reintentar es seguro.
-- ============================================================================

alter table public.sales
  add column if not exists client_ref text;

-- Único por organización, solo donde hay valor (las ventas viejas y las que se
-- hacen con conexión normal no necesitan uno).
create unique index if not exists uq_sales_client_ref
  on public.sales(organization_id, client_ref)
  where client_ref is not null;

-- ── fn_complete_sale, ahora idempotente ────────────────────────────────────
-- Igual que la 041 (conserva el cupo de crédito); solo agrega p_client_ref.
create or replace function public.fn_complete_sale(
  p_payment_method text,
  p_customer_id    uuid,
  p_subtotal       numeric,
  p_discount_total numeric,
  p_total          numeric,
  p_amount_paid    numeric,
  p_change_given   numeric,
  p_items          jsonb,
  p_client_ref     text default null
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
  v_limit   numeric;
  v_balance numeric;
  v_ref     text := nullif(trim(coalesce(p_client_ref, '')), '');
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  -- Reintento de una venta que ya entró: se devuelve la misma, no se duplica.
  if v_ref is not null then
    select id into v_sale_id from public.sales
    where client_ref = v_ref and organization_id = public.current_org_id();
    if found then
      return v_sale_id;
    end if;
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer', 'credit') then
    raise exception 'Método de pago no permitido';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  if p_customer_id is not null
     and not exists (select 1 from public.customers
                     where id = p_customer_id
                       and organization_id = public.current_org_id()) then
    raise exception 'Cliente no válido';
  end if;

  if p_payment_method = 'credit' then
    if p_customer_id is null then
      raise exception 'Una venta a crédito requiere un cliente';
    end if;

    select coalesce(credit_limit, 0) into v_limit
    from public.customers
    where id = p_customer_id and organization_id = public.current_org_id();

    if v_limit > 0 and not public.fn_action_is_free('perm_credit_over_limit') then
      select coalesce(
               (select sum(s.total) from public.sales s
                 where s.customer_id = p_customer_id
                   and s.payment_method = 'credit'
                   and s.status <> 'cancelled'
                   and s.organization_id = public.current_org_id()), 0)
             - coalesce(
               (select sum(cp.amount) from public.credit_payments cp
                 where cp.customer_id = p_customer_id
                   and cp.organization_id = public.current_org_id()), 0)
             - coalesce(
               (select sum(a.total_amount)
                  from public.sale_adjustments a
                  join public.sales s2 on s2.id = a.sale_id
                 where s2.customer_id = p_customer_id
                   and a.kind = 'return'
                   and a.status = 'approved'
                   and a.refund_method = 'credit_note'
                   and s2.status <> 'cancelled'
                   and a.organization_id = public.current_org_id()), 0)
        into v_balance;

      if v_balance + p_total > v_limit then
        raise exception
          'Este cliente se pasa de su cupo de crédito. Debe % y su cupo es % (esta venta suma %).',
          to_char(round(v_balance), 'FM$999G999G999'),
          to_char(round(v_limit),   'FM$999G999G999'),
          to_char(round(p_total),   'FM$999G999G999');
      end if;
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
    subtotal, discount_total, total, amount_paid, change_given, status,
    client_ref
  ) values (
    auth.uid(), p_customer_id, p_payment_method,
    p_subtotal, coalesce(p_discount_total, 0), p_total,
    v_paid, v_change, v_status,
    v_ref
  )
  returning id into v_sale_id;

  for v_it in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (v_it->>'product_id')::uuid;
    v_qty := (v_it->>'quantity')::numeric;

    if not exists (select 1 from public.products
                   where id = v_pid
                     and organization_id = public.current_org_id()) then
      raise exception 'Producto no válido';
    end if;

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
    where product_id = v_pid
      and organization_id = public.current_org_id();

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
