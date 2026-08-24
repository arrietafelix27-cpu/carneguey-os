-- ============================================================================
-- 036 · Patrón de código de barras de báscula por organización (Fase 3)
-- ----------------------------------------------------------------------------
-- Un ticket de báscula variable-peso codifica en el mismo EAN-13 el código del
-- producto y su peso. Hoy el POS asume posiciones fijas (la báscula DIBAL de
-- Carnegüey). Para servir a cualquier negocio, cada organización guarda su
-- propio patrón: dónde empieza y cuántos dígitos ocupa el código de producto,
-- lo mismo para el peso, y el divisor para convertir el entero del peso a kg
-- (kg = peso_entero / divisor).
--
-- Columnas NULLABLE: null = la organización todavía no configuró su báscula
-- (negocio nuevo). El POS lo maneja explícitamente (no falla en silencio).
--
-- Backfill: Carnegüey conserva EXACTAMENTE su patrón actual, que hoy está fijo
-- en el código (prefijo '2' + código 6 díg en pos 1-7 + peso 6 díg en pos 7-13,
-- en diezmilésimas de kg → divisor 10000). Índice base 0.
-- ============================================================================

alter table public.organizations
  add column if not exists barcode_code_start     smallint,
  add column if not exists barcode_code_len       smallint,
  add column if not exists barcode_weight_start   smallint,
  add column if not exists barcode_weight_len     smallint,
  add column if not exists barcode_weight_divisor integer;

update public.organizations
set barcode_code_start     = 1,
    barcode_code_len       = 6,
    barcode_weight_start   = 7,
    barcode_weight_len     = 6,
    barcode_weight_divisor = 10000
where slug = 'carneguey'
  and barcode_code_start is null;

-- ---- Guardar el patrón de la propia organización (solo admin) -------------
-- No se abre un UPDATE general sobre organizations (tendría name/status/slug);
-- este RPC acotado escribe solo las columnas del patrón, para current_org_id().
create or replace function public.fn_set_scale_pattern(
  p_code_start     smallint,
  p_code_len       smallint,
  p_weight_start   smallint,
  p_weight_len     smallint,
  p_weight_divisor integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo el administrador puede configurar la báscula';
  end if;
  if p_code_len <= 0 or p_weight_len <= 0 or p_weight_divisor <= 0 then
    raise exception 'Patrón de báscula inválido';
  end if;

  update public.organizations
     set barcode_code_start     = p_code_start,
         barcode_code_len       = p_code_len,
         barcode_weight_start   = p_weight_start,
         barcode_weight_len     = p_weight_len,
         barcode_weight_divisor = p_weight_divisor
   where id = public.current_org_id();
end;
$$;

grant execute on function public.fn_set_scale_pattern to authenticated;
