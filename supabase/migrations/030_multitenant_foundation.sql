-- ============================================================================
-- 030 · Cimiento multi-negocio (Fase 1) — organizations + organization_id
-- ----------------------------------------------------------------------------
-- Agrega la tabla organizations, la columna organization_id (NULLABLE por
-- ahora) a TODAS las tablas de negocio, hace backfill de los datos actuales a
-- una organización real (Carnegüey), crea current_org_id() y actualiza
-- handle_new_user para asignar la organización al crear un perfil.
--
-- Esta migración NO rompe nada: las columnas quedan nullable y las policies
-- siguen igual. El NOT NULL, las PK compuestas, las policies por org, las
-- funciones fn_* org-aware y el Storage vienen en 031→033. CORRER 030→033 en
-- orden, de una sentada, antes de volver a usar la app.
--
-- Idempotente: se puede volver a correr tal cual sobre un estado a medias.
-- ============================================================================

-- ── 1. Tabla organizations ─────────────────────────────────────────────────
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  status        text not null default 'trial'
                  check (status in ('trial','active','past_due','suspended','cancelled')),
  trial_ends_at timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ── 2. organization_id en profiles (antes de current_org_id) ───────────────
-- current_org_id() es language sql: Postgres valida su cuerpo al crearla, así
-- que la columna que consulta (profiles.organization_id) debe existir ya. El
-- loop del paso 5 la vuelve a listar, pero con "add column if not exists" no
-- pasa nada.
alter table public.profiles
  add column if not exists organization_id uuid references public.organizations(id);

-- ── 3. current_org_id(): la org del usuario autenticado ────────────────────
-- Se define ANTES de la policy que la usa. Se usa en TODAS las policies y
-- funciones. Nunca se confía en un organization_id que llegue como parámetro
-- del cliente.
create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.current_org_id to authenticated;

-- ── 4. Policy de organizations (cada usuario ve solo la suya) ──────────────
-- Escritura: superadmin (Fase 5); por ahora nadie escribe desde la app.
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select using (id = public.current_org_id());

grant select on public.organizations to authenticated;

-- ── 5. Organización semilla: los datos actuales de Carnegüey ────────────────
insert into public.organizations (name, slug, status)
values ('Carnegüey (datos de prueba)', 'carneguey', 'active')
on conflict (slug) do nothing;

-- ── 6. organization_id (nullable) + backfill + índice en cada tabla ────────
-- Todo dato existente pertenece a Carnegüey (era monoinquilino), así que el
-- backfill es uniforme. El NOT NULL se aplica en 033, después de que las
-- funciones (032) ya inserten el org.
do $$
declare
  v_org uuid := (select id from public.organizations where slug = 'carneguey');
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
  if v_org is null then
    raise exception 'No existe la organización semilla (slug carneguey)';
  end if;

  foreach t in array tables loop
    execute format(
      'alter table public.%I add column if not exists organization_id uuid references public.organizations(id)',
      t);
    execute format(
      'update public.%I set organization_id = %L where organization_id is null',
      t, v_org);
    execute format(
      'create index if not exists %I on public.%I(organization_id)',
      'idx_' || t || '_org', t);
  end loop;
end $$;

-- ── 7. handle_new_user: asigna la organización al crear el perfil ──────────
-- El organization_id llega en user_metadata (lo pone la Server Action que crea
-- el usuario, o el script del primer admin). Si falta, el insert viola el
-- NOT NULL (que se aplica en 033) y la creación falla en voz alta — nunca se
-- crea un perfil sin organización.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, role, active, organization_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'employee'),
    true,
    nullif(new.raw_user_meta_data->>'organization_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
