-- ============================================================================
-- 015 · Limpieza y actualización completa del catálogo de productos
-- ----------------------------------------------------------------------------
-- Operación de datos (no de esquema). Correr en el SQL Editor de Supabase.
--
-- RESUELTO CON FÉLIX:
--   · Morro (fcf1f38e) NO se elimina: se renombra a "Morrillo" y recibe
--     pos_code 16 (estaba en el paso de eliminar y en el de pos_code a la vez).
--   · Arepa: el id del plan traía un typo (…9c36-0a0413…); se usa el real
--     …9c36-4a0413cbfd92.
--
-- SEGURIDAD DE BORRADO: el PASO 2 solo ELIMINA los productos que no tienen
-- ningún registro histórico (movimientos, despostes, compras, conteos,
-- transferencias, sub-despostes). Los que sí tienen historial se DESACTIVAN
-- (active = false) en vez de borrarse, para no romper la trazabilidad.
--
-- RECOMENDACIÓN: corre primero SOLO el PASO 1 (es un SELECT) para ver qué
-- productos tienen historial. Luego corre del PASO 2 en adelante.
-- ============================================================================


-- ============================================================================
-- PASO 1 · VERIFICACIÓN PREVIA (solo lectura)
-- Muestra, por cada producto a eliminar, cuántos registros lo referencian y
-- si terminará ELIMINADO (sin historial) o DESACTIVADO (con historial).
-- ============================================================================
select
  p.category,
  p.name,
  p.id,
  (select count(*) from public.inventory_movements   m   where m.product_id = p.id)                                as movimientos,
  (select count(*) from public.desposte_items        di  where di.product_id = p.id)                               as desposte_items,
  (select count(*) from public.direct_purchases      dp  where dp.product_id = p.id)                               as compras,
  (select count(*) from public.physical_count_items  pci where pci.product_id = p.id)                              as conteos,
  (select count(*) from public.cut_transfers         ct  where ct.source_product_id = p.id or ct.dest_product_id = p.id) as transferencias,
  (select count(*) from public.sub_despostes         sd  where sd.source_product_id = p.id)                        as subdesp_origen,
  (select count(*) from public.sub_desposte_items    sdi where sdi.product_id = p.id)                              as subdesp_items,
  case when
        not exists (select 1 from public.inventory_movements  m   where m.product_id = p.id)
    and not exists (select 1 from public.desposte_items       di  where di.product_id = p.id)
    and not exists (select 1 from public.direct_purchases     dp  where dp.product_id = p.id)
    and not exists (select 1 from public.physical_count_items pci where pci.product_id = p.id)
    and not exists (select 1 from public.cut_transfers        ct  where ct.source_product_id = p.id or ct.dest_product_id = p.id)
    and not exists (select 1 from public.sub_despostes        sd  where sd.source_product_id = p.id)
    and not exists (select 1 from public.sub_desposte_items   sdi where sdi.product_id = p.id)
       then 'ELIMINAR' else 'DESACTIVAR' end as accion
from public.products p
where p.id in (
  '65355465-fd94-40ec-afbe-9f74d3075570', -- Cebo (res)
  '6fd3433d-67b2-49c8-9fa8-1397cc6ffa89', -- Pecho
  'cb27225d-783d-4590-8d28-7b5f6067059b', -- Pezuña
  '9b5d70da-dc00-4054-b9db-a7bd685cd4e4', -- Trocito res
  '1c5c9717-44ea-4f27-ad61-464a47b26ba5', -- Hueso chato carnudo
  'd4ebc3d9-8e30-43e9-b802-a23cd9073bb5', -- cebo (cerdo)
  '92bc7f34-2e28-447f-be7d-5d3f278c6ff2', -- Cebo c
  '170d28dc-3da4-4ea7-9c11-626a2d0881e6', -- molida corriente (cerdo)
  '7ae0ffa9-62af-4d46-9bf2-56c6a95b7555', -- Molida corriente cerdo
  '1b63df9b-9f1d-41ba-9457-c09dddde78ae', -- Trocito cerdo
  '70166c93-7110-48d8-91cc-62b9f5e61b6a'  -- Muslo
)
order by p.category, p.name;


-- ============================================================================
-- A partir de aquí, todo en una sola transacción (o pasa todo o no pasa nada).
-- ============================================================================
begin;

-- ============================================================================
-- PASO 2 · ELIMINACIONES / DESACTIVACIONES
-- ============================================================================

-- 2a) Elimina SOLO los que no tienen ningún historial que los referencie.
delete from public.products p
where p.id in (
  '65355465-fd94-40ec-afbe-9f74d3075570',
  '6fd3433d-67b2-49c8-9fa8-1397cc6ffa89',
  'cb27225d-783d-4590-8d28-7b5f6067059b',
  '9b5d70da-dc00-4054-b9db-a7bd685cd4e4',
  '1c5c9717-44ea-4f27-ad61-464a47b26ba5',
  'd4ebc3d9-8e30-43e9-b802-a23cd9073bb5',
  '92bc7f34-2e28-447f-be7d-5d3f278c6ff2',
  '170d28dc-3da4-4ea7-9c11-626a2d0881e6',
  '7ae0ffa9-62af-4d46-9bf2-56c6a95b7555',
  '1b63df9b-9f1d-41ba-9457-c09dddde78ae',
  '70166c93-7110-48d8-91cc-62b9f5e61b6a'
)
and not exists (select 1 from public.inventory_movements   m   where m.product_id = p.id)
and not exists (select 1 from public.desposte_items        di  where di.product_id = p.id)
and not exists (select 1 from public.direct_purchases      dp  where dp.product_id = p.id)
and not exists (select 1 from public.physical_count_items  pci where pci.product_id = p.id)
and not exists (select 1 from public.cut_transfers         ct  where ct.source_product_id = p.id or ct.dest_product_id = p.id)
and not exists (select 1 from public.sub_despostes         sd  where sd.source_product_id = p.id)
and not exists (select 1 from public.sub_desposte_items    sdi where sdi.product_id = p.id);

-- 2b) Los que sobrevivieron al DELETE (porque tienen historial) se desactivan.
update public.products set active = false
where id in (
  '65355465-fd94-40ec-afbe-9f74d3075570',
  '6fd3433d-67b2-49c8-9fa8-1397cc6ffa89',
  'cb27225d-783d-4590-8d28-7b5f6067059b',
  '9b5d70da-dc00-4054-b9db-a7bd685cd4e4',
  '1c5c9717-44ea-4f27-ad61-464a47b26ba5',
  'd4ebc3d9-8e30-43e9-b802-a23cd9073bb5',
  '92bc7f34-2e28-447f-be7d-5d3f278c6ff2',
  '170d28dc-3da4-4ea7-9c11-626a2d0881e6',
  '7ae0ffa9-62af-4d46-9bf2-56c6a95b7555',
  '1b63df9b-9f1d-41ba-9457-c09dddde78ae',
  '70166c93-7110-48d8-91cc-62b9f5e61b6a'
);


-- ============================================================================
-- PASO 3 · RENOMBRES
-- ============================================================================
update public.products set name = 'Asadura'                where id = '3497aca4-194d-40b6-8b08-a872fd64e0fd';
update public.products set name = 'Jarrete pierna'         where id = '7ee64b27-b311-4a32-985a-ca3672f7bbfd';
update public.products set name = 'Molida premium'         where id = 'cebd1f56-21a6-4ffc-9705-216b6c75646e';
update public.products set name = 'Salada premium'         where id = '4cd7b1bf-57c9-465f-bdc6-c81ea5c606f6';
update public.products set name = 'Carne salada'           where id = 'd9cdd2fc-e2e6-4671-afac-099ec4f1bfe7';
update public.products set name = 'Chuleta'                where id = '9483d735-1f2e-448d-8a73-e7c6b11dba9a';
update public.products set name = 'Costilla de lomo cerdo' where id = '19353a54-0f00-4371-923f-65ca7f610ab5';
update public.products set name = 'Pollo semicriollo'      where id = '0064bcff-6f26-46d2-9297-9c74be39b111';
update public.products set name = 'Paleta gourmet'         where id = 'aa93edef-a85a-4cd3-bd6c-9b0a710d8762';
-- Morro → Morrillo (decisión: conservar en vez de eliminar)
update public.products set name = 'Morrillo'               where id = 'fcf1f38e-453b-49c5-b87a-8275e525d695';


-- ============================================================================
-- PASO 4 · REACTIVACIONES
-- ============================================================================
update public.products set active = true where id = '52d36681-7c80-411c-9ae5-3f24ccee4202'; -- Sebo


-- ============================================================================
-- PASO 5 · INSERCIÓN DE PRODUCTO NUEVO
-- ============================================================================
insert into public.products (name, category, unit, origin, pos_code, active)
values ('Chorizos premium', 'other', 'unit', 'direct_purchase', '17', true);


-- ============================================================================
-- PASO 6 · CARGA DE pos_code (la columna es text; se guardan como texto)
-- ============================================================================

-- ---- RES ----
update public.products set pos_code = '1'   where id = 'a4b8e9f7-d3b8-4564-8914-3b064b56d97e'; -- Lomo fino
update public.products set pos_code = '2'   where id = 'db9eb3ff-65cc-4bae-b3cc-ccfd255f4100'; -- Lomo redondo
update public.products set pos_code = '3'   where id = '495cdc0a-821c-44d9-b53c-f800e45036ae'; -- Lomo ancho
update public.products set pos_code = '4'   where id = '4cd7b1bf-57c9-465f-bdc6-c81ea5c606f6'; -- Salada premium
update public.products set pos_code = '5'   where id = '2e57b077-e88d-47b7-a706-ab9bce269522'; -- Punta gorda
update public.products set pos_code = '6'   where id = '8fb54c7f-8a05-461e-b3e4-f2e4d5de8b27'; -- Masa pierna
update public.products set pos_code = '7'   where id = '5e40b2b3-161d-4f4d-b0db-ee4c066094fe'; -- Muchacho
update public.products set pos_code = '8'   where id = '1be45196-0e94-4a0e-9b75-9ff47cd3c125'; -- Carne chocozuela
update public.products set pos_code = '9'   where id = 'fad77352-c1a6-48de-8615-7b0bddd17ae2'; -- Cabeza lomo
update public.products set pos_code = '10'  where id = '5836500e-ec56-4e5e-b2ef-f10eedd83758'; -- Palomilla
update public.products set pos_code = '11'  where id = 'e251af63-a0b0-4a1b-bb47-df1adcdec74b'; -- Costilla gourmet res
update public.products set pos_code = '12'  where id = 'cebd1f56-21a6-4ffc-9705-216b6c75646e'; -- Molida premium
update public.products set pos_code = '13'  where id = '32aedec2-ad88-47d3-ac20-60282b3b44ee'; -- Carne goulash
update public.products set pos_code = '15'  where id = 'e3ee3f09-0c79-427d-aa35-652fc1751e7c'; -- Molida corriente
update public.products set pos_code = '16'  where id = 'fcf1f38e-453b-49c5-b87a-8275e525d695'; -- Morrillo
update public.products set pos_code = '18'  where id = '12559f88-9aae-4c8e-a5a2-eddf27da6a30'; -- Carne bistec
update public.products set pos_code = '19'  where id = '4287adb5-c5cc-48fe-8267-16654a586f35'; -- Hilachar
update public.products set pos_code = '20'  where id = '75b5e2d0-3190-4c40-a9cb-f71a744fa173'; -- Sobrebarriga delgada
update public.products set pos_code = '21'  where id = '99f9fc9a-471b-490f-a51d-620c4121df2e'; -- Sobrebarriga gruesa
update public.products set pos_code = '22'  where id = '43b75a29-e135-47ed-8c36-23a1e5ee9466'; -- Pecho espaldilla
update public.products set pos_code = '23'  where id = '7ee64b27-b311-4a32-985a-ca3672f7bbfd'; -- Jarrete pierna
update public.products set pos_code = '25'  where id = 'ef5af06f-636e-4173-a849-b2bf55f94b7e'; -- Hueso salado
update public.products set pos_code = '29'  where id = '73ce1d3c-420f-4d2e-a03f-0878696f289e'; -- Hueso paleta
update public.products set pos_code = '30'  where id = '1d9151f5-b242-49f7-9a22-174eb110aecf'; -- Osobuco
update public.products set pos_code = '31'  where id = 'd95da0df-ad75-4f96-a672-043d6e0059c6'; -- Costilla corriente
update public.products set pos_code = '32'  where id = 'e1646cce-1dca-472e-ae2b-5b5faa6b563c'; -- Hueso cogote
update public.products set pos_code = '34'  where id = '4d608283-4d3a-4959-82c5-dcf38f12bd06'; -- Hueso rabo
update public.products set pos_code = '35'  where id = 'ec17a388-a777-4017-8fe0-1ef8218a2050'; -- Hueso rojo
update public.products set pos_code = '36'  where id = '8dbef0e7-b68c-48ba-81c8-3304a9f58ad6'; -- Costilla super
update public.products set pos_code = '37'  where id = 'aa93edef-a85a-4cd3-bd6c-9b0a710d8762'; -- Paleta gourmet
update public.products set pos_code = '38'  where id = '059f5209-15b6-4808-8704-4f7fe928eb20'; -- Costilla especial
update public.products set pos_code = '53'  where id = '3497aca4-194d-40b6-8b08-a872fd64e0fd'; -- Asadura
update public.products set pos_code = '64'  where id = '89b336df-77ee-4086-9cd3-c3e7cf030fec'; -- Carne adobada
update public.products set pos_code = '68'  where id = '8d37601f-0406-4695-b323-5c549bb4bc98'; -- Ombligo salado
update public.products set pos_code = '72'  where id = '0eb068a5-ebae-439b-b4ae-0da48a89d137'; -- Lengua
update public.products set pos_code = '73'  where id = '69d27ee7-1eb4-4c19-ad40-68094b03243f'; -- Hígado
update public.products set pos_code = '74'  where id = 'fa3cabbb-e148-4f65-bda8-04954a300f8c'; -- Corazón
update public.products set pos_code = '75'  where id = 'ca0f5ce6-48ba-48b4-9a75-8744b6c892df'; -- Bofe
update public.products set pos_code = '76'  where id = '1a9089d8-0325-4487-85f5-07103196873f'; -- Ubre
update public.products set pos_code = '77'  where id = '3f8ef4dc-9ef4-491a-bb6c-b4f57290fb4f'; -- Panza
update public.products set pos_code = '79'  where id = 'ad4de203-0227-4858-8f32-96656ab04f3f'; -- Pajarilla
update public.products set pos_code = '80'  where id = '90a798c7-abb4-41df-b11c-ae8ce178e6a7'; -- Pata res
update public.products set pos_code = '84'  where id = '9ae67100-f490-43ad-b7f2-c06fe5a4d9f3'; -- Bofe salado
update public.products set pos_code = '85'  where id = '4d27d574-c84e-4d5d-b121-c9ce395112b9'; -- Galillo
update public.products set pos_code = '86'  where id = 'd9cdd2fc-e2e6-4671-afac-099ec4f1bfe7'; -- Carne salada
update public.products set pos_code = '159' where id = '52d36681-7c80-411c-9ae5-3f24ccee4202'; -- Sebo
update public.products set pos_code = '200' where id = '78882a3d-c2d1-4327-9b00-4d3d02502567'; -- Hueso blanco
update public.products set pos_code = '201' where id = '1c6ce516-3e90-4f87-b038-f7d1b211a669'; -- Molida super

-- ---- CERDO ----
update public.products set pos_code = '40'  where id = 'aa47ff01-34d6-47c5-91e8-838dae1d75f7'; -- Pulpa cerdo
update public.products set pos_code = '41'  where id = 'd7148b65-3b96-4465-a985-9a0b0222dc55'; -- Picada de cerdo
update public.products set pos_code = '44'  where id = '1397a4bb-613b-4d37-95f2-bcdb3e390560'; -- Costilla con piel
update public.products set pos_code = '45'  where id = '9483d735-1f2e-448d-8a73-e7c6b11dba9a'; -- Chuleta
update public.products set pos_code = '46'  where id = '6ee77761-1b7c-457e-8a05-877fa3364f97'; -- Costillita
update public.products set pos_code = '47'  where id = '98e08d4c-8b35-47bc-b3a6-774f9d47a7df'; -- Papada
update public.products set pos_code = '48'  where id = 'fa75a16b-2b97-428a-8493-e9c32d8391a8'; -- Tocino corriente
update public.products set pos_code = '49'  where id = '9b6e91bb-df5a-4f31-9ae3-28c5aee5ebf1'; -- Contra codillo
update public.products set pos_code = '50'  where id = '3f25b8d4-da56-4cfb-9675-dd2d717c90e3'; -- Codillo
update public.products set pos_code = '51'  where id = '8a48956c-c79a-4556-8a0e-72466b20a1b3'; -- Espinazo cerdo
update public.products set pos_code = '52'  where id = '2c318748-1e31-4e94-9660-cd7fbcec1c25'; -- Hueso cerdo
update public.products set pos_code = '54'  where id = '15b7b460-0875-48f9-b689-f4a8f251dd26'; -- Costilla gourmet sin piel
update public.products set pos_code = '55'  where id = '21f685b5-9a1c-4bbf-8b00-74319ad20b49'; -- Chuleta sin piel
update public.products set pos_code = '56'  where id = '968cfe29-0e75-41c2-bdbb-a328551dfdc3'; -- Tocino carnudo
update public.products set pos_code = '57'  where id = 'd6217f97-1914-42f1-80d3-949d4d91ef15'; -- Lomo cerdo
update public.products set pos_code = '202' where id = '19353a54-0f00-4371-923f-65ca7f610ab5'; -- Costilla de lomo cerdo

-- ---- POLLO ----
update public.products set pos_code = '87'  where id = 'ea1b37c2-c0d9-4f9b-870b-07fdf9d45deb'; -- Pollo entero
update public.products set pos_code = '88'  where id = '82ebc952-d7ca-45b0-9aef-b6cdd49785c3'; -- Pechuga
update public.products set pos_code = '89'  where id = '7e643287-674f-496d-bbb2-232cb511ecb5'; -- Pernil mixto
update public.products set pos_code = '90'  where id = 'be717f3e-00dd-4a40-a62d-72c15b047c5c'; -- Pechuga campesina
update public.products set pos_code = '91'  where id = '6f1d5bf6-d760-4284-9d06-9cf3f78f8373'; -- Alas
update public.products set pos_code = '93'  where id = 'd8063c46-6ad4-4712-a9b1-02409a4cd027'; -- Molleja
update public.products set pos_code = '95'  where id = '29ff251a-13a0-4c63-859a-4175ee5183f3'; -- Gallina
update public.products set pos_code = '97'  where id = '20bbed9c-72b2-4230-8863-efcba17ae08d'; -- Menudencia
update public.products set pos_code = '98'  where id = '1008f91f-0d41-4045-b711-1848b9525a77'; -- Pechuga filetada
update public.products set pos_code = '101' where id = '3f378126-1cc5-44cb-a317-96bb71477e5f'; -- Pernil campesino
update public.products set pos_code = '110' where id = '0064bcff-6f26-46d2-9297-9c74be39b111'; -- Pollo semicriollo
update public.products set pos_code = '111' where id = 'd4e59dd6-c67f-4fd9-a9e5-a26fcb122cd8'; -- Hueso pechuga
update public.products set pos_code = '203' where id = '068b99ce-eba8-40d3-9223-922372c270f3'; -- Ala campesina

-- ---- OTROS (el pos_code 17 = Chorizos premium ya quedó en el PASO 5) ----
update public.products set pos_code = '14'  where id = '8342df03-d53d-4890-9a18-db8b776e1ba2'; -- Chorizo res
update public.products set pos_code = '27'  where id = '6422787f-5f6d-4c35-aee8-ff8078085f07'; -- Carnero pierna
update public.products set pos_code = '113' where id = 'f6f49015-c804-4a50-ab65-01d087ee5bba'; -- Chorizo cerdo
update public.products set pos_code = '116' where id = '2313399e-01eb-464d-ab67-5a890700aaea'; -- Queso
update public.products set pos_code = '119' where id = '4d1ac1f9-702f-4fa5-9246-fab1e8993513'; -- Carnero
update public.products set pos_code = '157' where id = 'cbc65032-002d-456c-938d-d1c3397ed4a1'; -- Suero grande
update public.products set pos_code = '158' where id = '9a5a4516-0bb0-426b-9c36-4a0413cbfd92'; -- Arepa (id corregido)
update public.products set pos_code = '184' where id = 'ae62254a-2091-41fd-bd35-0566c4b54d16'; -- Condimentos
update public.products set pos_code = '204' where id = '30e1b581-b392-4bfb-8047-b8e93f70ff65'; -- Suero pequeño

commit;


-- ============================================================================
-- VERIFICACIÓN FINAL · catálogo completo ordenado por categoría y pos_code
-- ============================================================================
select
  category,
  pos_code,
  name,
  unit,
  origin,
  active,
  id
from public.products
order by category, nullif(pos_code, '')::int nulls last, name;
