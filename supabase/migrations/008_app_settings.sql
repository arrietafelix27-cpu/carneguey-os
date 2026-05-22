-- ============================================================================
-- 008 · app_settings — ajustes configurables de la app
-- ----------------------------------------------------------------------------
-- Tabla clave/valor para parámetros que Félix puede ajustar desde la app.
-- Primer uso: umbrales de merma de desposte (res y cerdo) para la sección
-- de Analítica. Solo el admin lee y escribe.
-- ============================================================================

create table public.app_settings (
  key        text primary key,
  value      numeric not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create policy app_settings_select on public.app_settings
  for select using (public.is_admin());

create policy app_settings_write on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.app_settings to authenticated;

-- Umbrales de merma por defecto (en %): por encima se marca como anormal.
insert into public.app_settings (key, value) values
  ('merma_threshold_beef', 8),
  ('merma_threshold_pork', 5)
on conflict (key) do nothing;
