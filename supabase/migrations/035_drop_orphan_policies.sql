-- ============================================================================
-- 035 · Elimina policies huérfanas sin filtro de organización
-- ----------------------------------------------------------------------------
-- Algunas policies se crearon a mano en la base con nombres que NUNCA
-- estuvieron en el repo (p. ej. employees_select_admin / employees_write_admin
-- en la tabla employees, creada a mano y versionada después en la 028). El
-- "drop policy if exists <nombre-del-repo>" de la 031 no las tocó porque el
-- nombre no coincidía. Al ser PERMISSIVE, se suman con OR a la policy nueva y
-- solo validan is_admin() (sin org) → dejan ver datos de todos los negocios.
--
-- Tras 031/034, TODA policy legítima de public filtra por current_org_id().
-- Así que cualquier policy permissive de public que NO lo mencione es huérfana
-- y se elimina. No depende de nombres: recorre pg_policies (la realidad de la
-- base, no el repo). Idempotente: re-correrla no encuentra nada.
--
-- No toca el esquema `storage` (las policies de receipts se recrearon por
-- nombre en la 033, sin huérfanas).
-- ============================================================================

do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and permissive = 'PERMISSIVE'
      and coalesce(qual, '') || coalesce(with_check, '') not ilike '%current_org_id%'
  loop
    raise notice 'Borrando policy huerfana: % en %.%',
      r.policyname, r.schemaname, r.tablename;
    execute format('drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
