-- ============================================================================
-- 041 · Cupo de crédito + dos correcciones de la 039
-- ----------------------------------------------------------------------------
-- 1. HUECO DE NEGOCIO: el cupo de crédito de los clientes nunca se respetó.
--    `customers.credit_limit` se guardaba y se mostraba en la ficha, pero
--    ninguna parte del código lo verificaba: se le podía vender $5.000.000 a
--    crédito a un cliente con $500.000 de cupo sin un solo aviso.
--
--    Semántica elegida para NO romper lo que ya existe:
--      · credit_limit = 0  → sin límite (es el valor por defecto de todos los
--        clientes hoy; tratarlo como "no puede fiar" habría roto la operación).
--      · credit_limit > 0  → ese es el tope: saldo actual + esta venta.
--
--    Nueva acción delicada `perm_credit_over_limit`: de fábrica la cajera NO
--    puede pasarse del cupo. El dueño puede soltarlo. No se hace con flujo de
--    aprobación porque el cliente está parado en el mostrador esperando —
--    aquí la decisión tiene que ser inmediata: se puede o no se puede.
--
-- 2. ERROR INTRODUCIDO EN LA 039 (doble devolución de inventario):
--    Anular una venta que YA tenía una devolución parcial aprobada devolvía
--    al inventario TODOS los productos de la venta, incluidos los que ya
--    habían vuelto por la devolución. El inventario quedaba inflado.
--    Se bloquea anular una venta que tenga devoluciones.
--
-- 3. ERROR INTRODUCIDO EN LA 039 (anulación pendiente + devolución):
--    Se podía pedir una devolución sobre una venta con una anulación
--    esperando aprobación. Si después se aprobaban las dos, mismo problema.
--    Se bloquea pedir devoluciones cuando hay una anulación en curso.
-- ============================================================================

-- ── 1. Nueva acción delicada: pasarse del cupo de crédito ──────────────────
insert into public.app_settings (organization_id, key, value)
select o.id, 'perm_credit_over_limit', 0
from public.organizations o
on conflict (organization_id, key) do nothing;

-- ── 2. fn_complete_sale: respeta el cupo de crédito ────────────────────────
-- Igual que la 032, con el bloque de cupo agregado. No se valida stock a
-- propósito: un POS no puede negarse a vender porque el inventario esté
-- desfasado — el cliente está en el mostrador. El descuadre lo concilia el
-- conteo quincenal.
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
  v_limit   numeric;
  v_balance numeric;
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

    -- Cupo de crédito. 0 = sin límite.
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

-- ── 3. fn_request_sale_adjustment: cierra los dos huecos de la 039 ─────────
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

  if exists (select 1 from public.daily_closings
             where closing_date = v_today
               and status = 'closed'
               and organization_id = public.current_org_id()) then
    raise exception
      'El cuadre de caja de hoy ya está cerrado. No se pueden registrar anulaciones ni devoluciones.';
  end if;

  if p_kind = 'void' then
    if v_sale_day <> v_today then
      raise exception
        'Solo se puede anular una venta el mismo día en que se hizo. Para una venta de otro día usa una devolución.';
    end if;

    -- CORRECCIÓN: anular devuelve al inventario TODOS los productos de la
    -- venta. Si ya hubo una devolución, esos productos volverían dos veces.
    if exists (select 1 from public.sale_adjustments
               where sale_id = p_sale_id
                 and kind = 'return'
                 and status in ('pending', 'approved')
                 and organization_id = public.current_org_id()) then
      raise exception
        'Esta venta ya tiene una devolución. No se puede anular: haz una devolución del resto.';
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
    -- CORRECCIÓN: no se puede devolver si hay una anulación en curso.
    if exists (select 1 from public.sale_adjustments
               where sale_id = p_sale_id
                 and kind = 'void'
                 and status = 'pending'
                 and organization_id = public.current_org_id()) then
      raise exception
        'Esta venta tiene una anulación esperando aprobación. Resuélvela antes de devolver.';
    end if;

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

  if v_free then
    perform public._apply_sale_adjustment(v_id);
  end if;

  return v_id;
end;
$$;
