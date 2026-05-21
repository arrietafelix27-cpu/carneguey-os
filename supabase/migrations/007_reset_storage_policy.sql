-- ============================================================================
-- 007 · reset: función limpia + policy para borrar comprobantes por la API
-- ----------------------------------------------------------------------------
-- La función de reset NO toca storage por SQL (Supabase no lo permite). El
-- borrado de las fotos de comprobantes lo hace la app vía Storage API; para
-- eso el admin necesita permiso de borrado sobre el bucket 'receipts'.
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

  delete from public.desposte_items       where true;
  delete from public.despostes            where true;
  delete from public.inventory_movements  where true;
  delete from public.direct_purchases     where true;
  delete from public.physical_count_items where true;
  delete from public.physical_counts      where true;
  delete from public.receipts             where true;
  delete from public.purchase_lots        where true;
  delete from public.lot_code_counters    where true;
end;
$$;

grant execute on function public.fn_reset_test_data to authenticated;

-- Permite al admin borrar fotos de comprobantes vía Storage API.
drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects
  for delete using (
    bucket_id = 'receipts' and public.is_admin()
  );
