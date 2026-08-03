-- ============================================================================
-- 029 · Cambio de contraseña obligatorio en el primer login
-- ----------------------------------------------------------------------------
-- Cuando el admin crea un usuario con contraseña temporal, se marca
-- must_change_password = true. Los layouts redirigen a /cambiar-clave hasta
-- que el usuario la cambie.
--
-- La RLS de profiles solo deja UPDATE al admin. Para que el propio usuario
-- pueda limpiar SU bandera tras cambiar la contraseña (sin darle UPDATE
-- general sobre profiles), se usa una función SECURITY DEFINER acotada a
-- auth.uid().
-- ============================================================================

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create or replace function public.fn_clear_must_change_password()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;
  update public.profiles
     set must_change_password = false
   where id = auth.uid();
end;
$$;

grant execute on function public.fn_clear_must_change_password to authenticated;
