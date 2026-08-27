-- ============================================================================
-- 040 · Comprobantes con foto — configurables por negocio
-- ----------------------------------------------------------------------------
-- Decisión de Félix (2026-08-27): igual que las acciones delicadas (038), el
-- dueño decide de qué se exige foto del comprobante y de qué no. Vive en la
-- misma pantalla de configuración, en una sección aparte.
--
-- Hoy esto está quemado en el código:
--   · Compra de canal (res/cerdo) → foto OBLIGATORIA
--   · Gastos y salidas           → foto OBLIGATORIA
--   · Llegada de canales         → foto OPCIONAL
-- Los valores de fábrica conservan exactamente ese comportamiento, así que
-- correr esta migración no cambia nada hasta que el dueño toque un interruptor.
--
-- Valores: 1 = exige foto · 0 = la foto es opcional.
-- Ausente = exige foto (el default seguro es el estricto).
--
-- NO se crea tabla nueva: se reusa `app_settings`, igual que la 038.
-- ============================================================================

-- ── 1. Valores de fábrica, para toda organización existente ────────────────
insert into public.app_settings (organization_id, key, value)
select o.id, d.key, d.value
from public.organizations o
cross join (values
  ('receipt_carcass_lot', 1),  -- hoy obligatoria: se conserva
  ('receipt_expense',     1),  -- hoy obligatoria: se conserva
  ('receipt_lot_arrival', 0)   -- hoy opcional: se conserva
) as d(key, value)
on conflict (organization_id, key) do nothing;

-- ── 2. fn_get_permissions ahora entrega también las reglas de comprobante ──
-- Misma función, mismo contrato: solo claves de política de la organización
-- del que llama. Nunca umbrales de merma ni ningún dato de plata.
create or replace function public.fn_get_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_active_user() then
    raise exception 'Usuario no autorizado';
  end if;

  select coalesce(jsonb_object_agg(s.key, s.value >= 1), '{}'::jsonb)
    into v_result
  from public.app_settings s
  where s.organization_id = public.current_org_id()
    and (s.key like 'perm\_%' or s.key like 'receipt\_%');

  return v_result;
end;
$$;

-- ── 3. Exigencia de foto, verificable desde la base ────────────────────────
-- El bloqueo real de "falta la foto" vive en las Server Actions, pero esta
-- función deja la regla en un solo lugar y disponible para la cajera.
create or replace function public.fn_receipt_required(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select s.value >= 1
       from public.app_settings s
      where s.organization_id = public.current_org_id()
        and s.key = p_key),
    true);
$$;

comment on function public.fn_receipt_required(text) is
  'true si la organización exige foto del comprobante para ese flujo. '
  'Si la clave no existe devuelve true (estricto por defecto).';

revoke all on function public.fn_receipt_required(text) from public;
grant execute on function public.fn_receipt_required(text) to authenticated;
