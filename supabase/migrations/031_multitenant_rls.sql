-- ============================================================================
-- 031 · RLS por organización (Fase 1)
-- ----------------------------------------------------------------------------
-- Reescribe TODAS las policies de las tablas de negocio para exigir
-- organization_id = current_org_id(), además del filtro por rol que ya había.
-- En las subconsultas exists() que apuntan a una tabla padre se agrega también
-- el filtro por org, para que nadie referencie filas de otra organización.
--
-- Con una sola organización (Carnegüey) el comportamiento es idéntico al de
-- antes; el aislamiento aplica cuando exista una segunda organización.
-- (Storage se aísla en 033.)
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    organization_id = public.current_org_id()
    and (id = auth.uid() or public.is_admin())
  );
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (
    organization_id = public.current_org_id() and public.is_admin()
  ) with check (
    organization_id = public.current_org_id() and public.is_admin());

-- ── providers / products ────────────────────────────────────────────────────
drop policy if exists providers_select on public.providers;
create policy providers_select on public.providers
  for select using (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists providers_write on public.providers;
create policy providers_write on public.providers
  for all using (
    organization_id = public.current_org_id() and public.is_admin()
  ) with check (
    organization_id = public.current_org_id() and public.is_admin());

drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists products_write on public.products;
create policy products_write on public.products
  for all using (
    organization_id = public.current_org_id() and public.is_admin()
  ) with check (
    organization_id = public.current_org_id() and public.is_admin());

-- ── purchase_lots ────────────────────────────────────────────────────────────
drop policy if exists lots_select_admin on public.purchase_lots;
create policy lots_select_admin on public.purchase_lots
  for select using (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists lots_insert on public.purchase_lots;
create policy lots_insert on public.purchase_lots
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
    and (
      public.is_admin()
      or (public.is_active_user()
          and type in ('beef_carcass', 'pork_carcass'))
    )
  );
drop policy if exists lots_update on public.purchase_lots;
create policy lots_update on public.purchase_lots
  for update using (
    organization_id = public.current_org_id()
    and (
      public.is_admin()
      or (public.is_active_user()
          and type = 'beef_live'
          and status = 'pending_arrival')
    )
  ) with check (
    organization_id = public.current_org_id()
    and (
      public.is_admin()
      or (public.is_active_user()
          and type = 'beef_live'
          and status in ('pending_arrival', 'active'))
    )
  );

-- ── direct_purchases ─────────────────────────────────────────────────────────
drop policy if exists dp_select_admin on public.direct_purchases;
create policy dp_select_admin on public.direct_purchases
  for select using (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists dp_insert on public.direct_purchases;
create policy dp_insert on public.direct_purchases
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid() and public.is_active_user());

-- ── despostes ────────────────────────────────────────────────────────────────
drop policy if exists desp_select on public.despostes;
create policy desp_select on public.despostes
  for select using (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists desp_insert on public.despostes;
create policy desp_insert on public.despostes
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid() and public.is_active_user());
drop policy if exists desp_update on public.despostes;
create policy desp_update on public.despostes
  for update using (
    organization_id = public.current_org_id()
    and public.is_active_user() and status = 'in_progress'
  ) with check (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists desp_delete on public.despostes;
create policy desp_delete on public.despostes
  for delete using (
    organization_id = public.current_org_id()
    and public.is_active_user() and status = 'in_progress');

-- ── desposte_items ───────────────────────────────────────────────────────────
drop policy if exists di_select on public.desposte_items;
create policy di_select on public.desposte_items
  for select using (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists di_insert on public.desposte_items;
create policy di_insert on public.desposte_items
  for insert with check (
    organization_id = public.current_org_id()
    and public.is_active_user()
    and exists (select 1 from public.despostes d
                where d.id = desposte_id and d.status = 'in_progress'
                  and d.organization_id = public.current_org_id())
  );
drop policy if exists di_delete on public.desposte_items;
create policy di_delete on public.desposte_items
  for delete using (
    organization_id = public.current_org_id()
    and public.is_active_user()
    and exists (select 1 from public.despostes d
                where d.id = desposte_id and d.status = 'in_progress'
                  and d.organization_id = public.current_org_id())
  );

-- ── inventory_movements ──────────────────────────────────────────────────────
drop policy if exists im_select_admin on public.inventory_movements;
create policy im_select_admin on public.inventory_movements
  for select using (
    organization_id = public.current_org_id() and public.is_admin());

-- ── physical_counts ──────────────────────────────────────────────────────────
drop policy if exists pc_select on public.physical_counts;
create policy pc_select on public.physical_counts
  for select using (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists pc_insert on public.physical_counts;
create policy pc_insert on public.physical_counts
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid() and public.is_active_user());
drop policy if exists pc_update on public.physical_counts;
create policy pc_update on public.physical_counts
  for update using (
    organization_id = public.current_org_id()
    and public.is_active_user() and status = 'in_progress'
  ) with check (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists pc_delete on public.physical_counts;
create policy pc_delete on public.physical_counts
  for delete using (
    organization_id = public.current_org_id()
    and public.is_active_user() and status = 'in_progress');

-- ── physical_count_items ─────────────────────────────────────────────────────
drop policy if exists pci_select on public.physical_count_items;
create policy pci_select on public.physical_count_items
  for select using (
    organization_id = public.current_org_id()
    and (
      public.is_admin()
      or exists (select 1 from public.physical_counts c
                 where c.id = physical_count_id and c.status = 'completed'
                   and c.organization_id = public.current_org_id())
    )
  );
drop policy if exists pci_update on public.physical_count_items;
create policy pci_update on public.physical_count_items
  for update using (
    organization_id = public.current_org_id()
    and public.is_active_user()
    and exists (select 1 from public.physical_counts c
                where c.id = physical_count_id and c.status = 'in_progress'
                  and c.organization_id = public.current_org_id())
  ) with check (
    organization_id = public.current_org_id()
    and public.is_active_user()
    and exists (select 1 from public.physical_counts c
                where c.id = physical_count_id and c.status = 'in_progress'
                  and c.organization_id = public.current_org_id())
  );

-- ── receipts ─────────────────────────────────────────────────────────────────
drop policy if exists rc_select on public.receipts;
create policy rc_select on public.receipts
  for select using (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists rc_insert on public.receipts;
create policy rc_insert on public.receipts
  for insert with check (
    organization_id = public.current_org_id()
    and uploaded_by = auth.uid() and public.is_active_user());

-- ── app_settings ─────────────────────────────────────────────────────────────
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select using (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all using (
    organization_id = public.current_org_id() and public.is_admin()
  ) with check (
    organization_id = public.current_org_id() and public.is_admin());

-- ── cut_transfers ────────────────────────────────────────────────────────────
drop policy if exists ct_select on public.cut_transfers;
create policy ct_select on public.cut_transfers
  for select using (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists ct_insert on public.cut_transfers;
create policy ct_insert on public.cut_transfers
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
    and public.is_active_user()
    and status = 'pending'
  );

-- ── sub_despostes ────────────────────────────────────────────────────────────
drop policy if exists sd_select on public.sub_despostes;
create policy sd_select on public.sub_despostes
  for select using (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists sd_insert on public.sub_despostes;
create policy sd_insert on public.sub_despostes
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
    and public.is_active_user()
    and status = 'pending'
  );

-- ── sub_desposte_items ───────────────────────────────────────────────────────
drop policy if exists sdi_select on public.sub_desposte_items;
create policy sdi_select on public.sub_desposte_items
  for select using (
    organization_id = public.current_org_id() and public.is_active_user());
drop policy if exists sdi_insert on public.sub_desposte_items;
create policy sdi_insert on public.sub_desposte_items
  for insert with check (
    organization_id = public.current_org_id()
    and public.is_active_user()
    and exists (
      select 1 from public.sub_despostes s
      where s.id = sub_desposte_id
        and s.status = 'pending'
        and s.created_by = auth.uid()
        and s.organization_id = public.current_org_id()
    )
  );
drop policy if exists sdi_delete on public.sub_desposte_items;
create policy sdi_delete on public.sub_desposte_items
  for delete using (
    organization_id = public.current_org_id()
    and public.is_active_user()
    and exists (
      select 1 from public.sub_despostes s
      where s.id = sub_desposte_id
        and s.status = 'pending'
        and s.created_by = auth.uid()
        and s.organization_id = public.current_org_id()
    )
  );

-- ── sales / sale_items ───────────────────────────────────────────────────────
drop policy if exists sales_select_admin on public.sales;
create policy sales_select_admin on public.sales
  for select using (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists sale_items_select_admin on public.sale_items;
create policy sale_items_select_admin on public.sale_items
  for select using (
    organization_id = public.current_org_id() and public.is_admin());

-- ── customers ────────────────────────────────────────────────────────────────
drop policy if exists customers_select_admin on public.customers;
create policy customers_select_admin on public.customers
  for select using (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists customers_write_admin on public.customers;
create policy customers_write_admin on public.customers
  for all using (
    organization_id = public.current_org_id() and public.is_admin()
  ) with check (
    organization_id = public.current_org_id() and public.is_admin());

-- ── credit_payments ──────────────────────────────────────────────────────────
drop policy if exists cp_select_admin on public.credit_payments;
create policy cp_select_admin on public.credit_payments
  for select using (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists cp_insert on public.credit_payments;
create policy cp_insert on public.credit_payments
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid() and public.is_active_user());

-- ── cash_outflows ────────────────────────────────────────────────────────────
drop policy if exists co_select on public.cash_outflows;
create policy co_select on public.cash_outflows
  for select using (
    organization_id = public.current_org_id()
    and (
      public.is_admin()
      or (
        created_by = auth.uid()
        and (created_at at time zone 'America/Bogota')::date
            = (now() at time zone 'America/Bogota')::date
      )
    )
  );
drop policy if exists co_insert on public.cash_outflows;
create policy co_insert on public.cash_outflows
  for insert with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid() and public.is_active_user());

-- ── daily_closings / daily_closing_items ─────────────────────────────────────
drop policy if exists dc_select on public.daily_closings;
create policy dc_select on public.daily_closings
  for select using (
    organization_id = public.current_org_id()
    and (
      public.is_admin()
      or closing_date = (now() at time zone 'America/Bogota')::date
    )
  );
drop policy if exists dci_select on public.daily_closing_items;
create policy dci_select on public.daily_closing_items
  for select using (
    organization_id = public.current_org_id()
    and (
      public.is_admin()
      or exists (
        select 1 from public.daily_closings d
        where d.id = daily_closing_id
          and d.closing_date = (now() at time zone 'America/Bogota')::date
          and d.organization_id = public.current_org_id()
      )
    )
  );

-- ── nómina (employees, employee_loans, payroll_*) ────────────────────────────
drop policy if exists employees_admin on public.employees;
create policy employees_admin on public.employees
  for all using (
    organization_id = public.current_org_id() and public.is_admin()
  ) with check (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists employee_loans_admin on public.employee_loans;
create policy employee_loans_admin on public.employee_loans
  for select using (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists payroll_payments_admin on public.payroll_payments;
create policy payroll_payments_admin on public.payroll_payments
  for select using (
    organization_id = public.current_org_id() and public.is_admin());
drop policy if exists payroll_deductions_admin on public.payroll_deductions;
create policy payroll_deductions_admin on public.payroll_deductions
  for select using (
    organization_id = public.current_org_id() and public.is_admin());

-- ── supplier_invoices / supplier_payments ────────────────────────────────────
drop policy if exists si_select on public.supplier_invoices;
create policy si_select on public.supplier_invoices
  for select using (
    organization_id = public.current_org_id()
    and (
      public.is_admin()
      or (
        is_private = false
        and public.is_active_user()
        and exists (
          select 1 from public.providers p
          where p.id = provider_id and p.is_private = false
            and p.organization_id = public.current_org_id()
        )
      )
    )
  );
drop policy if exists si_write_admin on public.supplier_invoices;
create policy si_write_admin on public.supplier_invoices
  for all using (
    organization_id = public.current_org_id() and public.is_admin()
  ) with check (
    organization_id = public.current_org_id() and public.is_admin());

drop policy if exists sp_select on public.supplier_payments;
create policy sp_select on public.supplier_payments
  for select using (
    organization_id = public.current_org_id()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.supplier_invoices si
        join public.providers p on p.id = si.provider_id
        where si.id = supplier_invoice_id
          and si.is_private = false
          and p.is_private = false
          and si.organization_id = public.current_org_id()
      )
    )
  );
