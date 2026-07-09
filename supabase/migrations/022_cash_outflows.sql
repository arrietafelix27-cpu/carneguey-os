-- ============================================================================
-- 022 · Egresos de efectivo (salidas de dinero de la caja durante el día)
-- ----------------------------------------------------------------------------
-- Distintos a los gastos operativos con foto. Las categorías 'sf' (Señor
-- Félix) y 'employee_advance' (adelanto a empleado) quedan PENDIENTES de
-- aprobación; las demás quedan aprobadas automáticamente.
--
-- El status NO se puede resolver con un DEFAULT de columna (depende de la
-- categoría), así que lo fuerza un trigger BEFORE INSERT. Eso también evita
-- que la cajera inserte directo con status='approved' y se salte la aprobación.
--
-- Regla de costos: la cajera solo ve SUS egresos y solo los del día actual
-- (se filtra en la propia RLS). El admin ve todo.
-- ============================================================================

create table public.cash_outflows (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  created_by        uuid not null references public.profiles(id),
  amount            numeric(12,2) not null check (amount > 0),
  category          text not null check (category in (
                      'sf', 'employee_advance', 'supplier_payment',
                      'expense', 'other')),
  recipient         text,
  notes             text,
  requires_approval boolean not null default false,
  approved_by       uuid references public.profiles(id),
  approved_at       timestamptz,
  status            text not null default 'pending' check (
                      status in ('pending', 'approved', 'rejected'))
);

create index idx_cash_outflows_created_at on public.cash_outflows(created_at);
create index idx_cash_outflows_status     on public.cash_outflows(status);

-- ---- Trigger: la categoría decide si requiere aprobación -------------------
create or replace function public._set_cash_outflow_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.category in ('sf', 'employee_advance') then
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

create trigger trg_set_cash_outflow_status
  before insert on public.cash_outflows
  for each row execute function public._set_cash_outflow_status();

-- ---- RLS ------------------------------------------------------------------
alter table public.cash_outflows enable row level security;

-- La cajera ve solo lo que ella registró HOY (hora de Colombia). Admin ve todo.
create policy co_select on public.cash_outflows
  for select using (
    public.is_admin()
    or (
      created_by = auth.uid()
      and (created_at at time zone 'America/Bogota')::date
          = (now() at time zone 'America/Bogota')::date
    )
  );

create policy co_insert on public.cash_outflows
  for insert with check (
    created_by = auth.uid() and public.is_active_user());

-- Sin policy de UPDATE/DELETE: la aprobación pasa por fn_review_cash_outflow.

grant select, insert on public.cash_outflows to authenticated;

-- ---- Aprobar / rechazar un egreso (solo admin) -----------------------------
create or replace function public.fn_review_cash_outflow(
  p_outflow_id uuid,
  p_approve    boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_o public.cash_outflows;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede revisar egresos';
  end if;

  select * into v_o from public.cash_outflows
  where id = p_outflow_id for update;
  if not found then
    raise exception 'Egreso no encontrado';
  end if;
  if v_o.status <> 'pending' then
    raise exception 'El egreso ya fue revisado';
  end if;

  update public.cash_outflows
     set status      = case when p_approve then 'approved' else 'rejected' end,
         approved_by = auth.uid(),
         approved_at = now()
   where id = p_outflow_id;
end;
$$;

grant execute on function public.fn_review_cash_outflow to authenticated;
