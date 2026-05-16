-- ============================================================================
-- Carnegüey OS · Datos semilla (seed)
-- ----------------------------------------------------------------------------
-- Ejecutar UNA SOLA VEZ, DESPUÉS de 001_initial_schema.sql, en el SQL Editor.
--
-- Crea:
--   · 9 proveedores reales de Carnegüey
--   · Catálogo real de productos de Carnegüey, todos con pos_code NULL
--
-- El campo providers.type ya no es relevante para el negocio (ver
-- DECISIONS.md D-013). Se conserva en la base por compatibilidad y se
-- llena con 'other' de forma interna. La UI lo ignora por completo.
--
-- LOS USUARIOS NO SE CREAN AQUÍ. Insertar usuarios a mano en auth.users por
-- SQL deja filas incompletas que rompen el login de Supabase (GoTrue lanza
-- "Database error querying schema"). Los 3 usuarios se crean por la API
-- oficial de administración con el script `scripts/seed-users.mjs`
-- (ver README / DECISIONS.md D-012). El profile se crea solo por el trigger
-- on_auth_user_created a partir de user_metadata.
-- ============================================================================

-- ---- USUARIOS: ver scripts/seed-users.mjs (API oficial de Supabase) -------

-- ---- PROVEEDORES ----------------------------------------------------------
-- Lista real de Carnegüey. type='other' fijo (campo en desuso, ver D-013).
insert into public.providers (name, type, phone)
select v.name, 'other', null
from (values
  ('Jairo Ospina'),
  ('Señor Félix'),
  ('Pitín'),
  ('Nando Meza'),
  ('Res Cárnica'),
  ('Eduardo'),
  ('La Marranera'),
  ('Nadin'),
  ('Mac Pollo')
) as v(name)
where not exists (select 1 from public.providers);

-- ---- PRODUCTOS ------------------------------------------------------------
-- Todos con pos_code NULL (se llenan desde admin cuando esté el export POS).

-- Res — origin from_processing, category beef
insert into public.products (name, category, unit, origin)
select v.name, 'beef', 'kg', 'from_processing'
from (values
  ('Lomo fino'), ('Lomo redondo'), ('Lomo ancho'), ('Salada extra fina'),
  ('Salada fina'), ('Punta gorda'), ('Masa pierna'), ('Muchacho'),
  ('Carne chocozuela'), ('Cabeza lomo'), ('Palomilla'), ('Morrillo'),
  ('Carne bistec'), ('Hilachar'), ('Sobrebarriga delgada'),
  ('Sobrebarriga gruesa'), ('Pecho espaldilla'), ('Jarrete pierna'),
  ('Trocito res'), ('Carne adobada'), ('Galillo'), ('Pata res'),
  ('Pezuña'), ('Costilla gourmet res'), ('Costilla super'),
  ('Costilla especial'), ('Costilla corriente'), ('Molida especial'),
  ('Molida'), ('Hueso salado'), ('Hueso rojo'), ('Hueso chato carnudo'),
  ('Hueso paleta'), ('Hueso cogote'), ('Hueso rabo'), ('Osobuco'),
  ('Bofe'), ('Bofe salado'), ('Panza'), ('Pajarilla'), ('Asadura'),
  ('Lengua'), ('Hígado'), ('Corazón'), ('Ombligo salado'), ('Sebo')
) as v(name)
where not exists (select 1 from public.products where category = 'beef');

-- Cerdo — origin from_processing, category pork
insert into public.products (name, category, unit, origin)
select v.name, 'pork', 'kg', 'from_processing'
from (values
  ('Lomo cerdo'), ('Pulpa cerdo'), ('Picada cerdo'),
  ('Costilla con piel'), ('Costillita'), ('Costilla gourmet sin piel'),
  ('Chuleta brazo'), ('Chuleta sin piel'), ('Papada'),
  ('Tocino corriente'), ('Tocino carnudo super'), ('Espinazo cerdo'),
  ('Hueso cerdo'), ('Cuadra codillo')
) as v(name)
where not exists (select 1 from public.products where category = 'pork');

-- Pollo — origin direct_purchase, category poultry
insert into public.products (name, category, unit, origin)
select v.name, 'poultry', v.unit, 'direct_purchase'
from (values
  ('Pollo entero',       'kg'),
  ('Pollo semicriollo',  'kg'),
  ('Gallina',            'kg'),
  ('Pechuga',            'kg'),
  ('Pechuga campesina',  'kg'),
  ('Pechuga filetada',   'kg'),
  ('Hueso pechuga',      'kg'),
  ('Pernil mixto',       'kg'),
  ('Pernil campesino',   'kg'),
  ('Alas',               'kg'),
  ('Ala campesina',      'kg'),
  ('Molleja',            'kg'),
  ('Menudencia',         'kg')
) as v(name, unit)
where not exists (select 1 from public.products where category = 'poultry');

-- Otros — origin direct_purchase, category other
insert into public.products (name, category, unit, origin)
select v.name, 'other', v.unit, 'direct_purchase'
from (values
  ('Chorizo cerdo',  'unit'),
  ('Chorizo res',    'unit'),
  ('Suero',          'unit'),
  ('Arepa',          'unit'),
  ('Condimentos',    'unit'),
  ('Queso',          'kg'),
  ('Carnero',        'kg'),
  ('Carnero pierna', 'kg')
) as v(name, unit)
where not exists (select 1 from public.products where category = 'other');

-- ============================================================================
-- FIN SEED
-- ============================================================================
