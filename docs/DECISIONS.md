# Decisiones del proyecto · Carnegüey OS

Registro de decisiones técnicas, dudas pendientes y deudas técnicas para
discusión. Las ideas que surgen fuera del alcance de v1.0 (sección 3.2
del spec) se anotan aquí en lugar de implementarlas.

---

## Decisiones tomadas

### D-001 · Next.js pinned a v15 en v1.0
**Fecha:** 2026-05-15
**Decisión:** Usar `next@15` (instalado: 15.5.18) en lugar de `next@latest` (16.x).
**Razón:** Estabilidad y coincidencia con la spec. Next.js 16 acaba de salir y trae breaking changes en caching, RSC y APIs internas. El ecosistema (shadcn, librerías) tarda 2-3 meses en estabilizarse en majors nuevos. Esta es una app real de negocio, no un experimento.
**Revisión:** Evaluar migración a v16 después de tener v1.0 estable en producción.

### D-002 · Conflictos spec vs Taste Skill — la spec gana
**Fecha:** 2026-05-15
**Decisión:** Cuando una regla de la design-taste-frontend skill choque con la spec maestra, la spec gana. Aplica especialmente a:
- Tipografía: SF Pro / `-apple-system` stack (spec §10.3), NO Geist/Outfit/Satoshi.
- Iconos: `lucide-react` (spec §10.7), NO Phosphor ni Radix Icons.
- Color primario: `#D40000` saturación 100% (rojo de marca Carnegüey, spec §10.2), NO desaturar pese a la regla de la skill.
- Layout densidad: tabla densa estilo iOS Settings con `divide-y` para listados de inventario/lotes/movimientos. Bento asimétrico solo en home/dashboard del admin.

**Razón:** La spec refleja la identidad de un negocio físico real de 10 años. Las reglas anti-AI-slop genéricas se respetan donde no haya conflicto (mobile-first, layout transitions, skeleton loaders, empty states, tactile feedback, `min-h-[100dvh]`, etc.).

### D-003 · Cálculo del costo unitario al despostar — server-side
**Fecha:** 2026-05-15
**Decisión:** El cálculo de `unit_cost = total_cost_lote / carcass_weight_kg` por corte se hace dentro de una función Postgres `SECURITY DEFINER` invocada desde el Server Action de finalizar desposte, dentro de la misma transacción. El cliente nunca calcula ni envía el costo.
**Razón:** Garantía adicional de que las cajeras no puedan inyectar costos manipulados ni leerlos por error.

### D-004 · Inserciones a `inventory_movements` solo vía funciones `SECURITY DEFINER`
**Fecha:** 2026-05-15
**Decisión:** Las policies sobre `inventory_movements` no permiten INSERT directo desde clientes con sesión `employee`. Las inserciones se hacen mediante funciones Postgres `SECURITY DEFINER` específicas para cada tipo de movimiento (`fn_insert_entry_direct`, `fn_finalize_desposte`, `fn_apply_count_adjustment`). Estas funciones son las únicas vías de escritura.
**Razón:** Encapsular la lógica de inventario, evitar manipulación del `unit_cost` desde el cliente y mantener la integridad como invariante a nivel de DB, no solo de aplicación.

---

## Deudas técnicas

### DT-001 · Contraseñas iniciales sin flow de cambio obligatorio
**Fecha:** 2026-05-15
**Descripción:** Los tres usuarios semilla se crean con contraseña provisional `Carneguey2026!`. No existe en v1.0 un flujo de "cambio obligatorio en primer login". Félix cambia las contraseñas manualmente desde Supabase Studio después del primer login de cada usuaria.
**Riesgo:** Si una contraseña inicial se filtra antes del cambio manual, el atacante tiene acceso a la cuenta hasta que Félix la rote.
**Acción futura:** Implementar `force_password_change` flag en `profiles` y middleware que redirige a `/cambiar-clave` mientras el flag esté en true. Evaluar para v1.1.

### DT-002 · `pos_code` de productos queda NULL en seed
**Fecha:** 2026-05-15
**Descripción:** El catálogo semilla no incluye los códigos de eSyspos porque Félix aún no tiene el export limpio. Los productos quedan con `pos_code IS NULL` y se llenan desde el panel de admin más adelante.
**Acción futura:** Cuando Félix consiga el export, importar masivamente con un script o desde admin.

---

## Dudas pendientes

(Sin entradas por ahora — todas las dudas se resolvieron en la sesión inicial del 2026-05-15.)

---

## Ideas fuera de alcance v1.0 (parking lot)

Espacio para anotar ideas que surjan durante el desarrollo y que NO entran en v1.0 (ver sección 3.2 del spec). No se implementan hasta versiones posteriores.

- _(vacío por ahora)_
