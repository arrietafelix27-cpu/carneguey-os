-- ============================================================================
-- 018 · Acceso a products.price: solo admin (regla inviolable de costos)
-- ----------------------------------------------------------------------------
-- La columna products.price (migración 017) es dato monetario. La regla del
-- proyecto (D-007) es que la cajera NO puede leer dinero por ningún medio, ni
-- siquiera con una query directa. Como admin y cajera comparten el mismo rol
-- de Postgres (authenticated), esto NO se puede lograr solo con RLS (que es
-- por fila, no por columna). Se usa el mismo patrón que el resto del dinero:
--
--   1. GRANT de SELECT a nivel de COLUMNA sobre products: todas las columnas
--      MENOS price. Así ni la cajera ni el admin pueden leer price con un
--      SELECT directo a la tabla.
--   2. Vista v_products_admin (definer, corre como owner) que expone price y
--      solo devuelve filas cuando is_admin() = true. El admin lee precios por
--      esta vista; la cajera obtiene 0 filas.
--
-- Escritura: sin cambios. La policy products_write (is_admin) ya restringe
-- INSERT/UPDATE/DELETE al admin, y el GRANT de UPDATE sigue a nivel de tabla
-- (cubre price), así que solo el admin puede fijar precios.
-- ============================================================================

-- 1) SELECT a nivel de columna (todas menos price).
revoke select on public.products from authenticated;

grant select (
  id, pos_code, name, category, unit, origin,
  active, created_at, shared_across_species
) on public.products to authenticated;

-- 2) Vista solo-admin con price. Sin security_invoker: corre como owner
--    (bypassa RLS y el grant por columna) y se filtra con is_admin().
create or replace view public.v_products_admin as
select
  id, pos_code, name, category, unit, origin,
  active, shared_across_species, price, created_at
from public.products
where public.is_admin();

grant select on public.v_products_admin to authenticated;
