-- ============================================================================
-- 013 · Sub-desposte (cajera crea, admin aprueba)
-- ----------------------------------------------------------------------------
-- Desposte de segundo nivel: se toma un producto que YA está en inventario y
-- se transforma en otros productos. Ej: 10 kg de costilla con piel → 9 kg de
-- costilla gourmet + 1 kg de sebo. La merma = kg de origen − Σ kg de salida.
--
-- La cajera lo registra en estado 'pending'; NO toca inventario. Solo cuando
-- Félix lo aprueba se descuenta el origen y se suman los productos resultantes.
--
-- Sin columnas de dinero → seguro para la cajera. El costo de origen se reparte
-- entre los kg de salida (la merma no lleva valor), conservando el valor total.
-- ============================================================================

create table public.sub_despostes (
  id                uuid primary key default gen_random_uuid(),
  source_product_id uuid not null references public.products(id),
  source_kg         numeric(10,2) not null check (source_kg > 0),
  status            text not null default 'pending' check (
                      status in ('pending', 'approved', 'rejected')),
  notes             text,
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  reviewed_by       uuid references public.profiles(id),
  reviewed_at       timestamptz
);

create table public.sub_desposte_items (
  id              uuid primary key default gen_random_uuid(),
  sub_desposte_id uuid not null references public.sub_despostes(id) on delete cascade,
  product_id      uuid not null references public.products(id),
  weight_kg       numeric(10,2) not null check (weight_kg > 0),
  unit_count      integer check (unit_count is null or unit_count > 0),
  created_at      timestamptz not null default now()
);

create index idx_sub_despostes_status on public.sub_despostes(status);
create index idx_sub_desposte_items_parent on public.sub_desposte_items(sub_desposte_id);

alter table public.sub_despostes      enable row level security;
alter table public.sub_desposte_items enable row level security;

-- Sin dinero: ambos roles leen. La cajera crea su sub-desposte en 'pending'.
create policy sd_select on public.sub_despostes
  for select using (public.is_active_user());
create policy sd_insert on public.sub_despostes
  for insert with check (
    created_by = auth.uid()
    and public.is_active_user()
    and status = 'pending'
  );
-- Sin update/delete directo: la revisión la hace fn_review_sub_desposte.

-- Items: se insertan mientras el sub-desposte está 'pending' y es de quien lo creó.
create policy sdi_select on public.sub_desposte_items
  for select using (public.is_active_user());
create policy sdi_insert on public.sub_desposte_items
  for insert with check (
    public.is_active_user()
    and exists (
      select 1 from public.sub_despostes s
      where s.id = sub_desposte_id
        and s.status = 'pending'
        and s.created_by = auth.uid()
    )
  );
create policy sdi_delete on public.sub_desposte_items
  for delete using (
    public.is_active_user()
    and exists (
      select 1 from public.sub_despostes s
      where s.id = sub_desposte_id
        and s.status = 'pending'
        and s.created_by = auth.uid()
    )
  );

grant select, insert         on public.sub_despostes      to authenticated;
grant select, insert, delete on public.sub_desposte_items to authenticated;

-- ---- Extender reference_type para 'sub_desposte' --------------------------
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
    'physical_count', 'cut_transfer', 'sub_desposte'));

-- ---- Aprobar / rechazar un sub-desposte (solo admin) ----------------------
create or replace function public.fn_review_sub_desposte(
  p_sub_id  uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sd          public.sub_despostes;
  v_avg         numeric;
  v_out_total   numeric;
  v_cost_per_kg numeric;
  v_item        record;
  v_qty         numeric;
  v_item_cost   numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede revisar sub-despostes';
  end if;

  select * into v_sd from public.sub_despostes
  where id = p_sub_id for update;
  if not found then
    raise exception 'Sub-desposte no encontrado';
  end if;
  if v_sd.status <> 'pending' then
    raise exception 'El sub-desposte ya fue revisado';
  end if;

  if p_approve then
    if not exists (select 1 from public.sub_desposte_items
                   where sub_desposte_id = p_sub_id) then
      raise exception 'No se puede aprobar un sub-desposte sin productos resultantes';
    end if;

    -- Costo promedio ponderado actual del producto origen.
    select coalesce(
             sum(case when quantity > 0 then quantity * unit_cost end)
               / nullif(sum(case when quantity > 0 then quantity end), 0),
             0)
      into v_avg
    from public.inventory_movements
    where product_id = v_sd.source_product_id;

    -- Total de kg que salen (la merma no lleva valor).
    select coalesce(sum(weight_kg), 0) into v_out_total
    from public.sub_desposte_items where sub_desposte_id = p_sub_id;

    -- Valor de origen repartido entre los kg de salida.
    v_cost_per_kg := round(
      (v_sd.source_kg * coalesce(v_avg, 0)) / nullif(v_out_total, 0), 4);

    -- Salida del origen.
    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      v_sd.source_product_id, 'adjustment_out', -v_sd.source_kg,
      round(coalesce(v_avg, 0), 4),
      'sub_desposte', v_sd.id,
      'Sub-desposte — salida del origen', auth.uid()
    );

    -- Entrada de cada producto resultante.
    for v_item in
      select sdi.*, p.unit as product_unit
      from public.sub_desposte_items sdi
      join public.products p on p.id = sdi.product_id
      where sdi.sub_desposte_id = p_sub_id
    loop
      if v_item.product_unit = 'unit' and v_item.unit_count is not null
         and v_item.unit_count > 0 then
        v_qty := v_item.unit_count;
        v_item_cost := round(
          v_cost_per_kg * v_item.weight_kg / v_item.unit_count, 4);
      else
        v_qty := v_item.weight_kg;
        v_item_cost := v_cost_per_kg;
      end if;

      insert into public.inventory_movements (
        product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, notes, created_by
      ) values (
        v_item.product_id, 'adjustment_in', v_qty,
        coalesce(v_item_cost, 0),
        'sub_desposte', v_sd.id,
        'Sub-desposte — producto resultante', auth.uid()
      );
    end loop;

    update public.sub_despostes
       set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_sub_id;
  else
    update public.sub_despostes
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_sub_id;
  end if;
end;
$$;

grant execute on function public.fn_review_sub_desposte to authenticated;
