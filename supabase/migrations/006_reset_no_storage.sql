-- ============================================================================
-- 006 · fix: fn_reset_test_data — no borrar storage por SQL
-- ----------------------------------------------------------------------------
-- Supabase no permite borrar directamente de las tablas de Storage por SQL
-- ("Direct deletion from storage tables is not allowed"). Se quita esa línea.
-- El reset borra toda la data de inventario, incluida la tabla `receipts`
-- (el índice de comprobantes). Las fotos en sí quedan en el bucket, pero son
-- inofensivas y no estaban en el alcance del reset.
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
  delete from public.desposte_items       where true;
  delete from public.despostes            where true;
  delete from public.inventory_movements  where true;
  delete from public.direct_purchases     where true;
  delete from public.physical_count_items where true;
  delete from public.physical_counts      where true;
  delete from public.receipts             where true;
  delete from public.purchase_lots        where true;

  -- Reinicia la numeración de lotes (RES/CER vuelven a 001).
  delete from public.lot_code_counters    where true;
end;
$$;

grant execute on function public.fn_reset_test_data to authenticated;
