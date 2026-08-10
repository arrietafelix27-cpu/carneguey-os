-- ============================================================================
-- 033 · Cierre multi-negocio (Fase 1)
-- ----------------------------------------------------------------------------
-- 1. DEFAULT current_org_id() + NOT NULL en organization_id de todas las
--    tablas de negocio. El DEFAULT hace que TODA fila insertada (por app o por
--    función) reciba la org del usuario, sin poder olvidarlo; el NOT NULL la
--    bloquea si no hay org.
-- 2. PK/unique compuestas donde la clave era global (app_settings,
--    lot_code_counters, daily_closings).
-- 3. gen_lot_code y fn_close_day org-aware (dependían de esas constraints).
-- 4. Storage: aislar receipts por carpeta {organization_id}/...
-- ============================================================================

-- ── 1. DEFAULT + NOT NULL en cada tabla ────────────────────────────────────
do $$
declare
  t text;
  tables text[] := array[
    'profiles','providers','products','purchase_lots','direct_purchases',
    'despostes','desposte_items','inventory_movements','physical_counts',
    'physical_count_items','cut_transfers','sub_despostes','sub_desposte_items',
    'customers','sales','sale_items','credit_payments','cash_outflows',
    'daily_closings','daily_closing_items','supplier_invoices','supplier_payments',
    'employees','employee_loans','payroll_payments','payroll_deductions',
    'receipts','app_settings','lot_code_counters'
  ];
begin
  foreach t in array tables loop
    execute format(
      'alter table public.%I alter column organization_id set default public.current_org_id()',
      t);
    execute format(
      'alter table public.%I alter column organization_id set not null', t);
  end loop;
end $$;

-- ── 2. Claves compuestas (antes eran globales) ─────────────────────────────
-- app_settings: (key) → (organization_id, key)
alter table public.app_settings drop constraint app_settings_pkey;
alter table public.app_settings add primary key (organization_id, key);

-- lot_code_counters: (prefix, year) → (organization_id, prefix, year)
alter table public.lot_code_counters drop constraint lot_code_counters_pkey;
alter table public.lot_code_counters
  add primary key (organization_id, prefix, year);

-- daily_closings: unique(closing_date) → unique(organization_id, closing_date)
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.daily_closings'::regclass and contype = 'u'
  loop
    execute format('alter table public.daily_closings drop constraint %I', c);
  end loop;
end $$;
alter table public.daily_closings
  add constraint daily_closings_org_date_key unique (organization_id, closing_date);

-- ── 3. gen_lot_code: secuencia de lote por organización ────────────────────
create or replace function public.gen_lot_code(p_type text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org    uuid := public.current_org_id();
  v_prefix text;
  v_year   int := extract(year from (now() at time zone 'America/Bogota'))::int;
  v_seq    int;
begin
  v_prefix := case
    when p_type in ('beef_live', 'beef_carcass') then 'RES'
    when p_type = 'pork_carcass'                 then 'CER'
    else null
  end;
  if v_prefix is null then
    raise exception 'Tipo de lote inválido para generar lot_code: %', p_type;
  end if;
  if v_org is null then
    raise exception 'Usuario sin organización';
  end if;

  insert into public.lot_code_counters (organization_id, prefix, year, last_seq)
  values (v_org, v_prefix, v_year, 1)
  on conflict (organization_id, prefix, year)
  do update set last_seq = lot_code_counters.last_seq + 1
  returning last_seq into v_seq;

  return v_prefix || '-' || v_year::text || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- ── 4. fn_close_day: cierre por organización ───────────────────────────────
create or replace function public.fn_close_day(
  p_date         date,
  p_counted_cash numeric,
  p_notes        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_s  record;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'El efectivo contado no es válido';
  end if;

  if exists (
    select 1 from public.daily_closings
    where closing_date = p_date and status = 'closed'
      and organization_id = public.current_org_id()
  ) then
    raise exception 'El día % ya fue cerrado', p_date;
  end if;

  select * into v_s from public.fn_daily_summary(p_date);

  if v_s.outflows_pending_count > 0 then
    raise exception
      'No se puede cerrar el día: hay % egreso(s) pendiente(s) de aprobación',
      v_s.outflows_pending_count;
  end if;

  insert into public.daily_closings (
    created_by, closing_date, status,
    expected_cash, counted_cash, difference, notes, closed_at
  ) values (
    auth.uid(), p_date, 'closed',
    v_s.expected_cash, p_counted_cash,
    (p_counted_cash - v_s.expected_cash), p_notes, now()
  )
  on conflict (organization_id, closing_date) do update
    set status        = 'closed',
        created_by    = auth.uid(),
        expected_cash = excluded.expected_cash,
        counted_cash  = excluded.counted_cash,
        difference    = excluded.difference,
        notes         = excluded.notes,
        closed_at     = now()
  returning id into v_id;

  delete from public.daily_closing_items where daily_closing_id = v_id;

  insert into public.daily_closing_items (daily_closing_id, category, amount)
  values
    (v_id, 'sales_cash',                 v_s.sales_cash),
    (v_id, 'sales_card',                 v_s.sales_card),
    (v_id, 'sales_transfer',             v_s.sales_transfer),
    (v_id, 'credit_sales',               v_s.credit_sales),
    (v_id, 'customer_payments_cash',     v_s.cp_cash),
    (v_id, 'customer_payments_card',     v_s.cp_card),
    (v_id, 'customer_payments_transfer', v_s.cp_transfer),
    (v_id, 'cash_outflows_approved',     v_s.outflows_approved),
    (v_id, 'cash_outflows_pending',      v_s.outflows_pending),
    (v_id, 'supplier_payments_cash',     v_s.supplier_payments_cash);

  return v_id;
end;
$$;

-- ── 5. Storage: receipts aislado por carpeta de organización ───────────────
-- Convención de ruta: {organization_id}/{entity_type}/{entity_id}/archivo.jpg
-- La primera carpeta debe coincidir con la org del usuario.
drop policy if exists receipts_read   on storage.objects;
drop policy if exists receipts_upload on storage.objects;
drop policy if exists receipts_delete on storage.objects;

create policy receipts_read on storage.objects
  for select using (
    bucket_id = 'receipts'
    and public.is_active_user()
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy receipts_upload on storage.objects
  for insert with check (
    bucket_id = 'receipts'
    and public.is_active_user()
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy receipts_delete on storage.objects
  for delete using (
    bucket_id = 'receipts'
    and public.is_admin()
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
