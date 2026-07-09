-- ============================================================================
-- 019 · Módulo POS — ventas (sales, sale_items) + descuento de inventario
-- ----------------------------------------------------------------------------
-- Fase 1 del POS. La cajera escanea tickets de la báscula (EAN-13) y cobra.
--
-- Acceso a precios (decisión de Félix): la cajera lee el PRECIO DE VENTA por
-- la vista v_pos_products (definer). Los costos/márgenes/valor de inventario
-- siguen 100% ocultos (unit_cost vive en inventory_movements, solo-admin).
--
-- Las tablas sales/sale_items tienen dinero → SELECT solo admin. La cajera
-- NO lee esas tablas: el POS calcula los totales en el cliente con los precios
-- de v_pos_products. La venta se guarda vía fn_complete_sale (SECURITY
-- DEFINER), que también descuenta el inventario.
-- ============================================================================

-- ---- Vista de productos para el POS (precio de venta, sin costos) ---------
-- Definer (corre como owner): expone price a cualquier usuario activo, pero
-- solo columnas de venta y solo productos activos.
create or replace view public.v_pos_products as
select
  p.id, p.pos_code, p.name, p.category, p.unit, p.price
from public.products p
where p.active = true
  and public.is_active_user();

grant select on public.v_pos_products to authenticated;

-- ---- Extender movement_type y reference_type para 'sale' ------------------
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.inventory_movements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%movement_type%'
  loop
    execute format(
      'alter table public.inventory_movements drop constraint %I', c);
  end loop;
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
  add constraint inventory_movements_movement_type_check
  check (movement_type in (
    'entry_direct', 'entry_desposte', 'adjustment_in', 'adjustment_out',
    'physical_count_adjustment', 'sale'));

alter table public.inventory_movements
  add constraint inventory_movements_reference_type_check
  check (reference_type in (
    'direct_purchase', 'desposte_item', 'adjustment', 'physical_count',
    'cut_transfer', 'sub_desposte', 'sale'));

-- ---- Tabla sales ----------------------------------------------------------
create table public.sales (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  created_by     uuid not null references public.profiles(id),
  payment_method text not null check (
                   payment_method in ('cash', 'card', 'transfer', 'credit')),
  subtotal       numeric(12,2) not null check (subtotal >= 0),
  total          numeric(12,2) not null check (total >= 0),
  amount_paid    numeric(12,2),
  change_given   numeric(12,2),
  status         text not null default 'completed' check (
                   status in ('completed', 'returned', 'cancelled')),
  customer_id    uuid  -- fase 2 (clientes a crédito); sin FK por ahora
);

-- ---- Tabla sale_items -----------------------------------------------------
-- quantity: kg para productos por peso, cantidad entera para productos 'unit'.
create table public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales(id) on delete cascade,
  product_id  uuid not null references public.products(id),
  quantity    numeric(10,3) not null check (quantity > 0),
  unit_price  numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) not null check (total_price >= 0),
  created_at  timestamptz not null default now()
);

create index idx_sales_created_by  on public.sales(created_by);
create index idx_sales_created_at   on public.sales(created_at);
create index idx_sale_items_sale    on public.sale_items(sale_id);
create index idx_sale_items_product on public.sale_items(product_id);

-- ---- RLS ------------------------------------------------------------------
alter table public.sales      enable row level security;
alter table public.sale_items enable row level security;

-- Dinero → SELECT solo admin. La cajera no lee estas tablas (el POS calcula
-- en el cliente). Los INSERT los hace fn_complete_sale (SECURITY DEFINER),
-- así que no se necesitan policies de escritura.
create policy sales_select_admin on public.sales
  for select using (public.is_admin());
create policy sale_items_select_admin on public.sale_items
  for select using (public.is_admin());

grant select on public.sales      to authenticated;
grant select on public.sale_items to authenticated;

-- ---- fn_complete_sale: guarda la venta y descuenta inventario -------------
create or replace function public.fn_complete_sale(
  p_payment_method text,
  p_subtotal       numeric,
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
  v_it      jsonb;
  v_pid     uuid;
  v_qty     numeric;
  v_avg     numeric;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Método de pago no permitido';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;

  insert into public.sales (
    created_by, payment_method, subtotal, total,
    amount_paid, change_given, status
  ) values (
    auth.uid(), p_payment_method, p_subtotal, p_total,
    p_amount_paid, p_change_given, 'completed'
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

    -- Costo promedio ponderado actual del producto (para valuar la salida).
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
