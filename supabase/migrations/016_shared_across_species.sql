-- ============================================================================
-- 016 · Productos compartidos entre especies (shared_across_species)
-- ----------------------------------------------------------------------------
-- Algunos productos (Sebo, Molida corriente) pueden salir del desposte de res
-- Y del de cerdo (y del de pollo), pero al estar categorizados como beef solo
-- aparecían en el desposte de res.
--
-- Se agrega products.shared_across_species: cuando es true, el producto está
-- disponible en el desposte de CUALQUIER especie, sin importar su categoría.
--
-- RLS: no requiere cambios. La lectura de products ya está permitida a ambos
-- roles (policy products_select con is_active_user) y los GRANT de la tabla
-- son a nivel de tabla (todas las columnas). La escritura de esta columna la
-- hace solo el admin (policy products_write con is_admin).
-- ============================================================================

alter table public.products
  add column if not exists shared_across_species boolean not null default false;

-- Productos que sí se comparten entre especies.
update public.products set shared_across_species = true
where id in (
  '52d36681-7c80-411c-9ae5-3f24ccee4202', -- Sebo
  'e3ee3f09-0c79-427d-aa35-652fc1751e7c'  -- Molida corriente
);

-- ---- Trigger de validación de cortes -------------------------------------
-- Antes exigía que la categoría del producto coincidiera con la del lote.
-- Ahora se acepta también cualquier producto marcado como compartido.
create or replace function public._check_desposte_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot_type  text;
  v_prod      public.products;
begin
  select pl.type into v_lot_type
  from public.despostes d
  join public.purchase_lots pl on pl.id = d.lot_id
  where d.id = new.desposte_id;

  select * into v_prod from public.products where id = new.product_id;
  if not found then
    raise exception 'Producto no encontrado';
  end if;

  if v_prod.category <> public._lot_category(v_lot_type)
     and not coalesce(v_prod.shared_across_species, false) then
    raise exception 'El producto % no corresponde a la categoría del lote',
      v_prod.name;
  end if;

  return new;
end;
$$;
