-- ============================================================================
-- 014 · Finalización manual de lotes con merma (solo admin)
-- ----------------------------------------------------------------------------
-- Cuando un lote ya se despostó por completo en el negocio, físicamente no
-- queda nada, pero en el sistema sobran kg teóricos por la merma natural.
-- Félix necesita cerrar esos lotes y mandar esos kg restantes a merma.
--
-- Esto NO genera movimientos de inventario (los kg restantes son canal sin
-- despostar, no un producto). Se guarda el remanente como final_merma_kg para
-- trazabilidad y para mostrarlo en la analítica del lote, y el lote pasa a
-- 'closed'. El cierre es siempre manual: la app solo sugiere cuándo.
-- ============================================================================

alter table public.purchase_lots
  add column if not exists closed_by      uuid references public.profiles(id),
  add column if not exists final_merma_kg numeric(10,2);

-- ---- Cerrar un lote enviando el remanente a merma (solo admin) -------------
create or replace function public.fn_close_lot_with_merma(p_lot_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lot        public.purchase_lots;
  v_despostado numeric;
  v_remaining  numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede finalizar lotes';
  end if;

  select * into v_lot from public.purchase_lots
  where id = p_lot_id for update;
  if not found then
    raise exception 'Lote no encontrado';
  end if;
  if v_lot.status <> 'active' then
    raise exception 'Solo se pueden finalizar lotes activos';
  end if;

  -- kg pendientes = peso de canal − Σ peso de entrada de despostes finalizados.
  select coalesce(sum(input_weight_kg), 0) into v_despostado
  from public.despostes
  where lot_id = p_lot_id and status = 'finalized';

  v_remaining := round(
    coalesce(v_lot.carcass_weight_kg, 0) - v_despostado, 2);
  if v_remaining < 0 then
    v_remaining := 0;
  end if;

  update public.purchase_lots
     set status         = 'closed',
         closed_at      = now(),
         closed_by      = auth.uid(),
         final_merma_kg = v_remaining
   where id = p_lot_id;
end;
$$;

grant execute on function public.fn_close_lot_with_merma to authenticated;
