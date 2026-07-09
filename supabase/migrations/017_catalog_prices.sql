-- ============================================================================
-- 017 · Catálogo: columna price + renumeración pos_code + precios + ajustes
-- ----------------------------------------------------------------------------
-- Operación de datos. Correr en el SQL Editor de Supabase.
--
-- DECISIÓN DE FÉLIX (2026-07-08):
--   · Condimentos SE ELIMINA (Paso 4.4). En consecuencia el código 609 y su
--     precio (7000) NO se usan: no existe ningún producto con pos_code 183 ni
--     609, así que esas dos líneas del plan son no-ops (se dejan por fidelidad).
--   · Con esto el catálogo queda en 83 productos activos (no 84).
--
-- Verificado contra los datos reales: los pos_code viejos (1..204) existen tal
-- cual y los nuevos (301..609) no colisionan con ninguno existente (todos ≤204).
--
-- SEGURIDAD DE BORRADO (Paso 4): los productos reemplazados/duplicados se
-- ELIMINAN solo si no tienen historial (movimientos, despostes, compras,
-- conteos, transferencias, sub-despostes); si lo tienen, se DESACTIVAN y se
-- libera su pos_code.
-- ============================================================================

begin;

-- ============================================================================
-- PASO 1 · Columna price
-- ============================================================================
alter table public.products
  add column if not exists price numeric(12,2);


-- ============================================================================
-- PASO 2 · Renumeración de pos_code (viejo → nuevo) por familia
-- Nota: ('183','609') no coincide con ningún producto (no existe 183) → no-op.
-- ============================================================================
update public.products p
set pos_code = m.new
from (values
  -- RES (301–347)
  ('1','301'),('2','302'),('3','303'),('4','304'),('5','305'),
  ('6','306'),('7','307'),('8','308'),('9','309'),('10','310'),
  ('11','311'),('12','312'),('13','313'),('15','314'),('16','315'),
  ('18','316'),('19','317'),('20','318'),('21','319'),('22','320'),
  ('23','321'),('25','322'),('29','323'),('30','324'),('31','325'),
  ('32','326'),('34','327'),('35','328'),('36','329'),('37','330'),
  ('38','331'),('53','332'),('64','333'),('68','334'),('72','335'),
  ('73','336'),('74','337'),('75','338'),('76','339'),('77','340'),
  ('79','341'),('80','342'),('84','343'),('85','344'),('86','345'),
  ('159','346'),('200','347'),
  -- CERDO (401–415)
  ('40','401'),('41','402'),('44','403'),('45','404'),('46','405'),
  ('47','406'),('48','407'),('49','408'),('50','409'),('51','410'),
  ('52','411'),('54','412'),('55','413'),('56','414'),('57','415'),
  -- POLLO (501–513)
  ('87','501'),('88','502'),('89','503'),('90','504'),('91','505'),
  ('93','506'),('95','507'),('97','508'),('98','509'),('101','510'),
  ('110','511'),('111','512'),('203','513'),
  -- OTROS (601–609; 183 no existe)
  ('14','601'),('17','602'),('27','603'),('113','604'),('116','605'),
  ('119','606'),('157','607'),('158','608'),('183','609')
) as m(old, new)
where p.pos_code = m.old;


-- ============================================================================
-- PASO 3 · Precios por pos_code nuevo
-- Nota: el código 609 no corresponde a ningún producto → no-op.
-- ============================================================================
update public.products p
set price = m.price
from (values
  -- RES
  ('301',54000),('302',40000),('303',40000),('304',31000),('305',50000),
  ('306',35000),('307',32000),('308',35000),('309',35000),('310',32000),
  ('311',25000),('312',30000),('313',30000),('314',8000),('315',26000),
  ('316',30000),('317',29000),('318',29000),('319',26000),('320',31000),
  ('321',26000),('322',10000),('323',22000),('324',17000),('325',10000),
  ('326',17000),('327',18000),('328',4000),('329',22000),('330',24000),
  ('331',17000),('332',7000),('333',35000),('334',17000),('335',24000),
  ('336',21000),('337',19000),('338',16000),('339',16000),('340',19000),
  ('341',8000),('342',8000),('343',16000),('344',3000),('345',30000),
  ('346',1000),('347',200),
  -- CERDO
  ('401',24000),('402',23000),('403',24000),('404',19000),('405',16000),
  ('406',16000),('407',7000),('408',16000),('409',12000),('410',19000),
  ('411',5000),('412',25000),('413',21000),('414',26000),('415',26000),
  -- POLLO
  ('501',13800),('502',18000),('503',10000),('504',18600),('505',10000),
  ('506',6900),('507',16000),('508',2500),('509',22000),('510',10400),
  ('511',14400),('512',4000),('513',10400),
  -- OTROS
  ('601',1500),('602',15000),('603',32000),('604',1900),('605',26000),
  ('606',50000),('607',4000),('608',2500),('609',7000)
) as m(code, price)
where p.pos_code = m.code;


-- ============================================================================
-- PASO 4 · Renombres y ajustes
-- ============================================================================

-- 4.1) El producto que ahora tiene pos_code '405' (antes "Costillita")
--      pasa a llamarse "Costilla de lomo cerdo".
update public.products set name = 'Costilla de lomo cerdo'
where pos_code = '405';

-- 4.2/4.3/4.4/4.5) Quitar productos reemplazados o duplicados:
--   '202' = "Costilla de lomo cerdo" viejo (reemplazado por el 405)
--   '201' = "Molida super"
--   '184' = "Condimentos"
--   '204' = "suero pequeño" (duplicado)
-- Se eliminan los que no tienen historial; el resto se desactiva.
delete from public.products p
where p.pos_code in ('202','201','184','204')
  and not exists (select 1 from public.inventory_movements   m   where m.product_id = p.id)
  and not exists (select 1 from public.desposte_items        di  where di.product_id = p.id)
  and not exists (select 1 from public.direct_purchases      dp  where dp.product_id = p.id)
  and not exists (select 1 from public.physical_count_items  pci where pci.product_id = p.id)
  and not exists (select 1 from public.cut_transfers         ct  where ct.source_product_id = p.id or ct.dest_product_id = p.id)
  and not exists (select 1 from public.sub_despostes         sd  where sd.source_product_id = p.id)
  and not exists (select 1 from public.sub_desposte_items    sdi where sdi.product_id = p.id);

update public.products
   set active = false, pos_code = null
 where pos_code in ('202','201','184','204');

commit;


-- ============================================================================
-- PASO 5 · VERIFICACIÓN FINAL
-- Con la decisión de eliminar Condimentos, el conteo esperado es 83 activos.
-- ============================================================================
select pos_code, name, price, unit
from public.products
where active = true
order by nullif(pos_code, '')::int nulls last, name;

select count(*) as productos_activos
from public.products
where active = true;
