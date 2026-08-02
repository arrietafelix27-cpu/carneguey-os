-- ============================================================================
-- 028 · Nómina + cierre de la deuda de migraciones corridas a mano
-- ----------------------------------------------------------------------------
-- Las tablas/funciones/vistas de nómina y varios ajustes de la "reorg de
-- gastos" se corrieron directo en Supabase y nunca quedaron versionados. Sin
-- esto, una instalación NUEVA desde el repo arranca rota (Nómina y Gastos).
-- Esta migración los reconstruye tal como existen en producción.
--
-- Idempotente (if not exists / or replace): segura de re-correr. La instancia
-- de producción ya tiene todo esto; NO hace falta correrla ahí.
-- ============================================================================

-- ── Ajustes a objetos existentes (faltaban en el repo) ──────────────────────

-- cash_outflows.subcategory: los "gastos operativos" la usan.
alter table public.cash_outflows
  add column if not exists subcategory text;

-- receipts: aceptar comprobantes de egresos (entity_type = 'cash_outflow').
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.receipts'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%entity_type%'
  loop
    execute format('alter table public.receipts drop constraint %I', c);
  end loop;
end $$;

alter table public.receipts
  add constraint receipts_entity_type_check
  check (entity_type in ('purchase_lot', 'direct_purchase', 'cash_outflow'));

-- ── Tablas de nómina ────────────────────────────────────────────────────────

create table if not exists public.employees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text,
  phone      text,
  salary     numeric(12,2) not null default 0 check (salary >= 0),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_loans (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id),
  amount          numeric(12,2) not null check (amount > 0),
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  notes           text,
  cash_outflow_id uuid references public.cash_outflows(id),
  created_by      uuid not null references public.profiles(id),
  created_at      timestamptz not null default now()
);

create table if not exists public.payroll_payments (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id),
  payment_date     date not null,
  period           text not null check (period in ('first', 'second')),
  gross_amount     numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null default 0,
  net_amount       numeric(12,2) not null default 0,
  receipt_url      text,
  notes            text,
  created_by       uuid not null references public.profiles(id),
  created_at       timestamptz not null default now()
);

create table if not exists public.payroll_deductions (
  id                 uuid primary key default gen_random_uuid(),
  payroll_payment_id uuid not null references public.payroll_payments(id) on delete cascade,
  employee_loan_id   uuid references public.employee_loans(id),
  description        text not null,
  amount             numeric(12,2) not null check (amount > 0),
  created_at         timestamptz not null default now()
);

create index if not exists idx_employee_loans_employee    on public.employee_loans(employee_id);
create index if not exists idx_employee_loans_outflow      on public.employee_loans(cash_outflow_id);
create index if not exists idx_payroll_payments_employee   on public.payroll_payments(employee_id);
create index if not exists idx_payroll_deductions_payment  on public.payroll_deductions(payroll_payment_id);
create index if not exists idx_payroll_deductions_loan     on public.payroll_deductions(employee_loan_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Todo es dinero (salario, préstamos, pagos) → SELECT solo admin. La cajera
-- solo ve id+name de empleados activos por v_employees_active (dropdown de
-- préstamos). Las escrituras pasan por funciones SECURITY DEFINER.

alter table public.employees          enable row level security;
alter table public.employee_loans     enable row level security;
alter table public.payroll_payments   enable row level security;
alter table public.payroll_deductions enable row level security;

drop policy if exists employees_admin          on public.employees;
drop policy if exists employee_loans_admin      on public.employee_loans;
drop policy if exists payroll_payments_admin     on public.payroll_payments;
drop policy if exists payroll_deductions_admin   on public.payroll_deductions;

-- employees: el admin crea/edita directo desde el panel → for all.
create policy employees_admin on public.employees
  for all using (public.is_admin()) with check (public.is_admin());

-- Las otras 3: solo lectura admin. Se escriben vía funciones definer.
create policy employee_loans_admin on public.employee_loans
  for select using (public.is_admin());
create policy payroll_payments_admin on public.payroll_payments
  for select using (public.is_admin());
create policy payroll_deductions_admin on public.payroll_deductions
  for select using (public.is_admin());

grant select, insert, update, delete on public.employees to authenticated;
grant select on public.employee_loans     to authenticated;
grant select on public.payroll_payments    to authenticated;
grant select on public.payroll_deductions  to authenticated;

-- ── Vistas ──────────────────────────────────────────────────────────────────

-- Empleados activos para la cajera: solo id + name (sin salario). Vista normal
-- (corre como owner, no hereda la RLS admin-only de employees).
create or replace view public.v_employees_active as
select id, name
from public.employees
where active = true and public.is_active_user();

grant select on public.v_employees_active to authenticated;

-- Resumen mensual de nómina (solo admin). Nota: hoy el código no la consume;
-- se reconstruye con una forma razonable (agregado por mes y empleado).
create or replace view public.v_monthly_payroll as
select
  p.employee_id,
  e.name                                     as employee_name,
  date_trunc('month', p.payment_date)::date  as month,
  count(*)                                   as payments,
  sum(p.gross_amount)::numeric(14,2)         as gross_total,
  sum(p.total_deductions)::numeric(14,2)     as deductions_total,
  sum(p.net_amount)::numeric(14,2)           as net_total
from public.payroll_payments p
join public.employees e on e.id = p.employee_id
where public.is_admin()
group by p.employee_id, e.name, date_trunc('month', p.payment_date);

grant select on public.v_monthly_payroll to authenticated;

-- ── Funciones ───────────────────────────────────────────────────────────────

-- Crea un préstamo a empleado: un egreso (categoría 'employee_advance', que el
-- trigger deja pendiente de aprobación) + el préstamo enlazado. Devuelve el id
-- del egreso (la pantalla de gastos le adjunta la foto del soporte).
create or replace function public.fn_create_employee_loan(
  p_employee_id uuid,
  p_amount      numeric,
  p_notes       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outflow_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;
  if not exists (
    select 1 from public.employees where id = p_employee_id and active
  ) then
    raise exception 'Empleado no válido';
  end if;

  insert into public.cash_outflows (created_by, amount, category, notes)
  values (auth.uid(), p_amount, 'employee_advance', p_notes)
  returning id into v_outflow_id;

  insert into public.employee_loans (
    employee_id, amount, status, notes, cash_outflow_id, created_by
  ) values (
    p_employee_id, p_amount, 'pending', p_notes, v_outflow_id, auth.uid()
  );

  return v_outflow_id;
end;
$$;

grant execute on function public.fn_create_employee_loan to authenticated;

-- Aprobar/rechazar un egreso; si es un adelanto a empleado, sincroniza el
-- préstamo enlazado. REEMPLAZA la versión de la 022 (que no sincronizaba).
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

  -- Sincroniza el préstamo a empleado enlazado (si existe).
  update public.employee_loans
     set status = case when p_approve then 'approved' else 'rejected' end
   where cash_outflow_id = p_outflow_id;
end;
$$;

grant execute on function public.fn_review_cash_outflow to authenticated;

-- Registra un pago de quincena: el pago + sus deducciones (descuentos de
-- préstamos). Valida que ninguna deducción exceda el saldo del préstamo.
-- p_deductions: jsonb array de { employee_loan_id, description, amount }.
create or replace function public.fn_register_payroll_payment(
  p_payment_date date,
  p_period       text,
  p_employee_id  uuid,
  p_gross        numeric,
  p_net          numeric,
  p_notes        text,
  p_receipt_url  text,
  p_deductions   jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment_id uuid;
  v_total_ded  numeric := 0;
  v_d          jsonb;
  v_loan_id    uuid;
  v_amount     numeric;
  v_remaining  numeric;
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede registrar pagos de nómina';
  end if;
  if p_period not in ('first', 'second') then
    raise exception 'Período inválido';
  end if;

  -- Suma de deducciones + validación de saldo por préstamo.
  if p_deductions is not null then
    for v_d in select * from jsonb_array_elements(p_deductions)
    loop
      v_amount := coalesce((v_d->>'amount')::numeric, 0);
      if v_amount <= 0 then continue; end if;
      v_total_ded := v_total_ded + v_amount;

      v_loan_id := nullif(v_d->>'employee_loan_id', '')::uuid;
      if v_loan_id is not null then
        select l.amount - coalesce(sum(pd.amount), 0)
          into v_remaining
        from public.employee_loans l
        left join public.payroll_deductions pd on pd.employee_loan_id = l.id
        where l.id = v_loan_id and l.status = 'approved'
        group by l.amount;

        if v_remaining is null then
          raise exception 'Préstamo no válido para descuento';
        end if;
        if v_amount > v_remaining + 0.01 then
          raise exception 'La deducción excede el saldo del préstamo';
        end if;
      end if;
    end loop;
  end if;

  insert into public.payroll_payments (
    employee_id, payment_date, period, gross_amount,
    total_deductions, net_amount, receipt_url, notes, created_by
  ) values (
    p_employee_id, p_payment_date, p_period, coalesce(p_gross, 0),
    v_total_ded, coalesce(p_net, 0), p_receipt_url, p_notes, auth.uid()
  )
  returning id into v_payment_id;

  if p_deductions is not null then
    for v_d in select * from jsonb_array_elements(p_deductions)
    loop
      v_amount := coalesce((v_d->>'amount')::numeric, 0);
      if v_amount <= 0 then continue; end if;
      insert into public.payroll_deductions (
        payroll_payment_id, employee_loan_id, description, amount
      ) values (
        v_payment_id,
        nullif(v_d->>'employee_loan_id', '')::uuid,
        coalesce(v_d->>'description', ''),
        v_amount
      );
    end loop;
  end if;

  return v_payment_id;
end;
$$;

grant execute on function public.fn_register_payroll_payment to authenticated;
