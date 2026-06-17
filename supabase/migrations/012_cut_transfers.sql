-- ============================================================================
-- 012 · Transferencia de cortes (cajera crea, admin aprueba)
-- ----------------------------------------------------------------------------
-- Cuando un corte se agota pero se sigue vendiendo bajo ese nombre usando otro
-- corte de la misma familia, el inventario se descuadra. Esta función deja a
-- la cajera REGISTRAR ese movimiento 1:1 (X kg del origen → X kg al destino)
-- en estado 'pending'. Solo cuando Félix lo APRUEBA se refleja en inventario.
--
-- La tabla NO tiene columnas de dinero, así que es segura para la cajera. El
-- costo solo aparece en inventory_movements (RLS solo-admin) al aprobar.
-- ============================================================================

create table public.cut_transfers (
  id                uuid primary key default gen_random_uuid(),
  source_product_id uuid not null references public.products(id),
  dest_product_id   uuid not null references public.products(id),
  quantity_kg       numeric(10,2) not null check (quantity_kg > 0),
  status            text not null default 'pending' check (
                      status in ('pending', 'approved', 'rejected')),
  notes             text,
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  reviewed_by       uuid references public.profiles(id),
  reviewed_at       timestamptz,
  constraint chk_ct_distinct check (source_product_id <> dest_product_id)
);

create index idx_cut_transfers_status on public.cut_transfers(status);

alter table public.cut_transfers enable row level security;

-- Sin dinero: ambos roles pueden leer; la cajera crea las suyas en 'pending'.
create policy ct_select on public.cut_transfers
  for select using (public.is_active_user());
create policy ct_insert on public.cut_transfers
  for insert with check (
    created_by = auth.uid()
    and public.is_active_user()
    and status = 'pending'
  );
-- Sin policy de UPDATE/DELETE: la revisión la hace fn_review_cut_transfer
-- (SECURITY DEFINER). Así nadie cambia el estado sin pasar por la trazabilidad.

grant select, insert on public.cut_transfers to authenticated;

-- ---- Extender reference_type de inventory_movements para 'cut_transfer' ----
do $$
declare c text;
begin
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
  add constraint inventory_movements_reference_type_check
  check (reference_type in (
    'direct_purchase', 'desposte_item', 'adjustment',
    'physical_count', 'cut_transfer'));

-- ---- Aprobar / rechazar una transferencia (solo admin) --------------------
create or replace function public.fn_review_cut_transfer(
  p_transfer_id uuid,
  p_approve     boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_t   public.cut_transfers;
  v_avg numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede revisar transferencias';
  end if;

  select * into v_t from public.cut_transfers
  where id = p_transfer_id for update;
  if not found then
    raise exception 'Transferencia no encontrada';
  end if;
  if v_t.status <> 'pending' then
    raise exception 'La transferencia ya fue revisada';
  end if;

  if p_approve then
    -- Costo promedio ponderado actual del producto origen (solo entradas).
    select coalesce(
             sum(case when quantity > 0 then quantity * unit_cost end)
               / nullif(sum(case when quantity > 0 then quantity end), 0),
             0)
      into v_avg
    from public.inventory_movements
    where product_id = v_t.source_product_id;

    -- Salida del origen (cantidad negativa).
    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      v_t.source_product_id, 'adjustment_out', -v_t.quantity_kg,
      round(coalesce(v_avg, 0), 4),
      'cut_transfer', v_t.id,
      'Transferencia de corte — salida', auth.uid()
    );

    -- Entrada al destino (mismo valor por kg que el origen, 1:1 en kg).
    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      v_t.dest_product_id, 'adjustment_in', v_t.quantity_kg,
      round(coalesce(v_avg, 0), 4),
      'cut_transfer', v_t.id,
      'Transferencia de corte — entrada', auth.uid()
    );

    update public.cut_transfers
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_transfer_id;
  else
    update public.cut_transfers
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_transfer_id;
  end if;
end;
$$;

grant execute on function public.fn_review_cut_transfer to authenticated;
