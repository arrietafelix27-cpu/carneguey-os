-- ============================================================================
-- 038 · Acciones delicadas — el dueño decide qué necesita su aprobación
-- ----------------------------------------------------------------------------
-- Decisión de Félix (2026-08-26): ciertas acciones sensibles deben poder
-- configurarse por negocio — la cajera las hace sola, o quedan pendientes de
-- aprobación del dueño. Esto es lo que hace que Miura se sienta personalizado
-- para cada carnicería, y de paso suelta lo que hoy está rígido en el código.
--
-- NO se crea tabla nueva: los ajustes viven en `app_settings` (clave/valor por
-- organización, ya aislada por RLS desde la 033).
--
-- Valores: 1 = la cajera puede sola · 0 = necesita aprobación del admin.
-- Ausente = necesita aprobación (el default seguro es el estricto).
--
-- Cambios de comportamiento respecto a hoy:
--   · Transferencias de cortes y sub-despostes pasan a aplicarse solos
--     (de fábrica quedan sueltos). Antes SIEMPRE requerían aprobación.
--   · Los egresos de efectivo de categoría 'sf' y 'employee_advance' siguen
--     requiriendo aprobación de fábrica, pero ahora se puede soltar.
--
-- perm_void_sale y perm_return_sale se siembran aquí pero todavía no tienen
-- efecto: anular y devolver ventas se construyen en el paso 1b.
-- ============================================================================

-- ── 1. Valores de fábrica, para toda organización existente ────────────────
insert into public.app_settings (organization_id, key, value)
select o.id, d.key, d.value
from public.organizations o
cross join (values
  ('perm_cut_transfer',  1),  -- suelto: no mueve plata, pasa todos los días
  ('perm_sub_desposte',  1),  -- suelto: transforma carne, no mueve plata
  ('perm_cash_outflow',  0),  -- aprobación: sale plata del cajón
  ('perm_void_sale',     0),  -- aprobación: forma clásica de robo (1b)
  ('perm_return_sale',   0)   -- aprobación: sale plata por carne que quizá no volvió (1b)
) as d(key, value)
on conflict (organization_id, key) do nothing;

-- ── 2. Lectura de permisos ─────────────────────────────────────────────────
-- app_settings es solo-admin por RLS, pero la cajera necesita saber qué puede
-- hacer. Estas funciones definer entregan ÚNICAMENTE las claves `perm_*` de la
-- organización del que llama — nunca umbrales de merma ni ningún dato de plata.

create or replace function public.fn_action_is_free(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select s.value >= 1
       from public.app_settings s
      where s.organization_id = public.current_org_id()
        and s.key = p_key),
    false);
$$;

comment on function public.fn_action_is_free(text) is
  'true si la organización configuró la acción como "la cajera puede sola". '
  'Si la clave no existe devuelve false (estricto por defecto).';

create or replace function public.fn_get_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select coalesce(jsonb_object_agg(s.key, s.value >= 1), '{}'::jsonb)
    into v_result
  from public.app_settings s
  where s.organization_id = public.current_org_id()
    and s.key like 'perm\_%';

  return v_result;
end;
$$;

revoke all on function public.fn_action_is_free(text) from public;
revoke all on function public.fn_get_permissions() from public;
grant execute on function public.fn_action_is_free(text) to authenticated;
grant execute on function public.fn_get_permissions() to authenticated;

-- ── 3. fn_review_cut_transfer — respeta el ajuste ──────────────────────────
-- Idéntica a la 037 (conserva el bloqueo por stock insuficiente); solo cambia
-- la guarda de permisos: si la acción está suelta, quien la creó puede
-- aplicarla él mismo. Nadie puede revisar la de otra persona sin ser admin.
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
  v_t     public.cut_transfers;
  v_avg   numeric;
  v_stock numeric;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_t from public.cut_transfers
  where id = p_transfer_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Transferencia no encontrada';
  end if;

  if not public.is_admin() then
    if not public.fn_action_is_free('perm_cut_transfer') then
      raise exception 'Solo el administrador puede revisar transferencias';
    end if;
    if v_t.created_by <> auth.uid() then
      raise exception 'Solo el administrador puede revisar transferencias de otra persona';
    end if;
  end if;

  if v_t.status <> 'pending' then
    raise exception 'La transferencia ya fue revisada';
  end if;

  if p_approve then
    select coalesce(sum(quantity), 0) into v_stock
    from public.inventory_movements
    where product_id = v_t.source_product_id
      and organization_id = public.current_org_id();
    if v_stock < v_t.quantity_kg then
      raise exception
        'No hay suficiente inventario del corte de origen (disponible % kg, se piden % kg).',
        round(v_stock, 2), round(v_t.quantity_kg, 2);
    end if;

    select coalesce(
             sum(case when quantity > 0 then quantity * unit_cost end)
               / nullif(sum(case when quantity > 0 then quantity end), 0),
             0)
      into v_avg
    from public.inventory_movements
    where product_id = v_t.source_product_id
      and organization_id = public.current_org_id();

    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      v_t.source_product_id, 'adjustment_out', -v_t.quantity_kg,
      round(coalesce(v_avg, 0), 4),
      'cut_transfer', v_t.id,
      'Transferencia de corte — salida', auth.uid()
    );

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

-- ── 4. fn_review_sub_desposte — respeta el ajuste ──────────────────────────
-- Idéntica a la 037 (conserva el bloqueo por stock insuficiente y la
-- exigencia de productos resultantes); solo cambia la guarda de permisos.
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
  v_stock       numeric;
  v_item        record;
  v_qty         numeric;
  v_item_cost   numeric;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select * into v_sd from public.sub_despostes
  where id = p_sub_id and organization_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'Sub-desposte no encontrado';
  end if;

  if not public.is_admin() then
    if not public.fn_action_is_free('perm_sub_desposte') then
      raise exception 'Solo el administrador puede revisar sub-despostes';
    end if;
    if v_sd.created_by <> auth.uid() then
      raise exception 'Solo el administrador puede revisar sub-despostes de otra persona';
    end if;
  end if;

  if v_sd.status <> 'pending' then
    raise exception 'El sub-desposte ya fue revisado';
  end if;

  if p_approve then
    if not exists (select 1 from public.sub_desposte_items
                   where sub_desposte_id = p_sub_id) then
      raise exception 'No se puede aprobar un sub-desposte sin productos resultantes';
    end if;

    select coalesce(sum(quantity), 0) into v_stock
    from public.inventory_movements
    where product_id = v_sd.source_product_id
      and organization_id = public.current_org_id();
    if v_stock < v_sd.source_kg then
      raise exception
        'No hay suficiente inventario del producto de origen (disponible % kg, se piden % kg).',
        round(v_stock, 2), round(v_sd.source_kg, 2);
    end if;

    select coalesce(
             sum(case when quantity > 0 then quantity * unit_cost end)
               / nullif(sum(case when quantity > 0 then quantity end), 0),
             0)
      into v_avg
    from public.inventory_movements
    where product_id = v_sd.source_product_id
      and organization_id = public.current_org_id();

    select coalesce(sum(weight_kg), 0) into v_out_total
    from public.sub_desposte_items where sub_desposte_id = p_sub_id;

    v_cost_per_kg := round(
      (v_sd.source_kg * coalesce(v_avg, 0)) / nullif(v_out_total, 0), 4);

    insert into public.inventory_movements (
      product_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, notes, created_by
    ) values (
      v_sd.source_product_id, 'adjustment_out', -v_sd.source_kg,
      round(coalesce(v_avg, 0), 4),
      'sub_desposte', v_sd.id,
      'Sub-desposte — salida del origen', auth.uid()
    );

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

-- ── 5. Egresos de efectivo — la categoría sigue mandando, el ajuste afloja ──
-- Igual que la 022, pero las categorías que exigen aprobación ('sf' y
-- 'employee_advance') se sueltan si el negocio configuró perm_cash_outflow = 1.
-- Las demás categorías siguen aprobándose solas, como hoy.
create or replace function public._set_cash_outflow_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.category in ('sf', 'employee_advance')
     and not public.fn_action_is_free('perm_cash_outflow') then
    new.requires_approval := true;
    new.status := 'pending';
  else
    new.requires_approval := false;
    new.status := 'approved';
  end if;
  -- La aprobación solo la escribe fn_review_cash_outflow.
  new.approved_by := null;
  new.approved_at := null;
  return new;
end;
$$;
