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
  ('Lomo fino'), ('Lomo ancho'), ('Punta de anca'), ('Sobrebarriga'),
  ('Pierna'), ('Cadera'), ('Bola de pierna'), ('Murillo'), ('Posta'),
  ('Falda'), ('Pecho'), ('Costilla con piel'), ('Costilla gourmet sin piel'),
  ('Carne de bisteck'), ('Carne goulash'), ('Cabeza de lomo'), ('Bofe'),
  ('Bofe salado'), ('Asadura'), ('Corazón'), ('Hígado'), ('Lengua'),
  ('Hueso carnudo'), ('Hueso de tuétano'), ('Molida corriente'),
  ('Sebo'), ('Cola'), ('Rabo')
) as v(name)
where not exists (select 1 from public.products where category = 'beef');

-- Cerdo — origin from_processing, category pork
insert into public.products (name, category, unit, origin)
select v.name, 'pork', 'kg', 'from_processing'
from (values
  ('Lomo de cerdo'), ('Pernil'), ('Costilla de cerdo'), ('Tocino'),
  ('Papada'), ('Espinazo'), ('Cabeza de cerdo'), ('Manitas'),
  ('Pierna de cerdo'), ('Brazuelo'), ('Chicharrón'), ('Molida de cerdo'),
  ('Hueso de cerdo')
) as v(name)
where not exists (select 1 from public.products where category = 'pork');

-- Pollo — origin direct_purchase, category poultry
insert into public.products (name, category, unit, origin)
select v.name, 'poultry', v.unit, 'direct_purchase'
from (values
  ('Pechuga de pollo', 'kg'),
  ('Muslo',            'kg'),
  ('Contramuslo',      'kg'),
  ('Alas',             'kg'),
  ('Pollo entero',     'unit'),
  ('Molleja',          'kg'),
  ('Hígado de pollo',  'kg'),
  ('Gallina criolla',  'unit')
) as v(name, unit)
where not exists (select 1 from public.products where category = 'poultry');

-- Otros — origin direct_purchase, category other
insert into public.products (name, category, unit, origin)
select v.name, 'other', v.unit, 'direct_purchase'
from (values
  ('Arepa',          'unit'),
  ('Chorizo de cerdo','unit'),
  ('Chorizo de res', 'unit'),
  ('Queso costeño',  'kg'),
  ('Suero costeño',  'unit'),
  ('Butifarra',      'unit')
) as v(name, unit)
where not exists (select 1 from public.products where category = 'other');

-- ============================================================================
-- FIN SEED
-- ============================================================================
