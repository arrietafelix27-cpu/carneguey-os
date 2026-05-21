-- ============================================================================
-- 004 · Función para resetear datos de prueba
-- ----------------------------------------------------------------------------
-- Borra TODA la data transaccional de inventario (lotes, despostes, compras
-- directas, movimientos, conteos, comprobantes) y reinicia la numeración de
-- lotes. NO toca productos, proveedores ni usuarios.
-- Solo el administrador puede ejecutarla.
-- ============================================================================

create or replace function public.fn_reset_test_data()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede resetear los datos';
  end if;

  -- Orden respetando llaves foráneas: hijos antes que padres.
  delete from public.desposte_items;
  delete from public.despostes;
  delete from public.inventory_movements;
  delete from public.direct_purchases;
  delete from public.physical_count_items;
  delete from public.physical_counts;
  delete from public.receipts;
  delete from public.purchase_lots;

  -- Reinicia la numeración de lotes (RES/CER vuelven a 001).
  delete from public.lot_code_counters;

  -- Limpia las fotos de comprobantes de prueba.
  delete from storage.objects where bucket_id = 'receipts';
end;
$$;

grant execute on function public.fn_reset_test_data to authenticated;
