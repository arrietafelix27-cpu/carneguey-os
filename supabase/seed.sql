-- ============================================================================
-- Carnegüey OS · Datos semilla (seed)
-- ----------------------------------------------------------------------------
-- Ejecutar UNA SOLA VEZ, DESPUÉS de 001_initial_schema.sql, en el SQL Editor.
--
-- Crea:
--   · 3 usuarios (1 admin + 2 cajeras), contraseña inicial Carneguey2026!
--   · 5 proveedores de ejemplo
--   · Catálogo base de productos (spec §12), todos con pos_code NULL
--
-- Los profiles se crean SOLOS por el trigger on_auth_user_created (Bloque G)
-- a partir de user_metadata. No hay que insertarlos a mano.
--
-- Si la creación de usuarios por SQL falla en tu instancia de Supabase, hay
-- un plan B manual por el panel (ver instrucciones que te entregué). Los
-- proveedores y productos sí entran siempre por SQL.
-- ============================================================================

-- pgcrypto para hashear contraseñas (crypt / gen_salt). En Supabase ya viene.
create extension if not exists pgcrypto with schema extensions;

-- ---- USUARIOS -------------------------------------------------------------
-- Patrón: insertar en auth.users + auth.identities. El trigger del Bloque G
-- crea el profile con el role que va en raw_user_meta_data.

do $$
declare
  v_uid uuid;
begin
  -- Admin: Félix
  if not exists (select 1 from auth.users where email = 'arrietafelix27@gmail.com') then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated',
      'authenticated', 'arrietafelix27@gmail.com',
      extensions.crypt('Carneguey2026!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Félix Arrieta","role":"admin"}'::jsonb,
      now(), now()
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', 'arrietafelix27@gmail.com'),
      'email', now(), now(), now()
    );
  end if;

  -- Cajera 1
  if not exists (select 1 from auth.users where email = 'cajera1@carneguey.com') then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated',
      'authenticated', 'cajera1@carneguey.com',
      extensions.crypt('Carneguey2026!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Cajera 1","role":"employee"}'::jsonb,
      now(), now()
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', 'cajera1@carneguey.com'),
      'email', now(), now(), now()
    );
  end if;

  -- Cajera 2
  if not exists (select 1 from auth.users where email = 'cajera2@carneguey.com') then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated',
      'authenticated', 'cajera2@carneguey.com',
      extensions.crypt('Carneguey2026!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Cajera 2","role":"employee"}'::jsonb,
      now(), now()
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', 'cajera2@carneguey.com'),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- ---- PROVEEDORES ----------------------------------------------------------
insert into public.providers (name, type, phone)
select * from (values
  ('Don Hernán Pérez',           'live_cattle',   null),
  ('Frigorífico La Esperanza',   'beef_carcass',  null),
  ('Cerdos del Caribe',          'pork_carcass',  null),
  ('Mac Pollo',                  'poultry',       null),
  ('Doña Luz Arepas',            'other',         null)
) as v(name, type, phone)
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
