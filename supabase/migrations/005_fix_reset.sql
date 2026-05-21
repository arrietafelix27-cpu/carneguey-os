-- ============================================================================
-- 005 · fix: fn_reset_test_data — agregar WHERE a cada DELETE
-- ----------------------------------------------------------------------------
-- Supabase tiene activada la protección "safeupdate" que rechaza DELETE/UPDATE
-- sin cláusula WHERE ("DELETE requires a WHERE clause"). Se agrega `where true`
-- a cada borrado: borra todo igual, pero satisface la protección.
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

  -- Limpia las fotos de comprobantes de prueba.
  delete from storage.objects where bucket_id = 'receipts';
end;
$$;

grant execute on function public.fn_reset_test_data to authenticated;
