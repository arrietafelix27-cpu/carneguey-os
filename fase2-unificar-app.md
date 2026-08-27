# Fase 2 — Una sola app (Miura)

## Contexto para ti, Claude Code

La Fase 1 (multi-negocio) ya cerró: cada tabla, vista y política RLS
filtra por `organization_id`, verificado en vivo con una organización
de prueba. Ahora toca la Fase 2: hoy la app tiene dos árboles de rutas
separados por URL — `app/(admin)/admin/...` y
`app/(employee)/empleado/...`. El objetivo es que exista **una sola
experiencia**, donde lo que ve cada persona depende de su rol (leído
de la sesión), no de a qué URL entró.

Antes de empezar: lee `CLAUDE.md`, `docs/DECISIONS.md`, y recorre
completos ambos árboles de rutas actuales (`app/(admin)` y
`app/(employee)`) para entender qué pantallas existen de cada lado,
cuáles se parecen y cuáles son completamente distintas. Confírmame en
un par de líneas qué encontraste antes de tocar nada.

## Objetivo de la fase

Un dueño y una cajera entran por la **misma puerta** (`/`, o la que
definas), y cada quien ve su propio menú y sus propias pantallas,
determinado por `profiles.role` — nunca por la URL a la que intentó
llegar. Si una cajera escribe a mano la URL de una pantalla de admin,
debe rebotar, no solo ocultarse en el menú.

## Alcance — qué SÍ entra en esta fase

1. Una sola estructura de rutas. Decide tú el patrón más simple de
   mantener (por ejemplo, quitar los grupos `(admin)`/`(employee)` y
   resolver el layout/menú según rol en un layout compartido, o
   mantener carpetas separadas mecánicamente pero con un único punto
   de entrada que redirige según rol — lo que genere menos código
   duplicado a futuro). Documenta la decisión en `DECISIONS.md` con el
   porqué.
2. Protección real, no solo de menú: si una cajera entra directo por
   URL a una pantalla de admin (o viceversa si aplica), el servidor
   debe bloquear el acceso — redirigir a su panel, no mostrar la
   pantalla ni por un instante ni devolver datos.
3. Navegación única: un solo menú/barra que muestra las opciones según
   rol, reemplazando el sidebar de PC y la barra inferior de móvil que
   existen hoy por separado (si es que hoy también están duplicados
   entre admin/empleado — confírmalo al leer el código).
4. Actualizar todos los enlaces internos (`Link href=...`,
   `redirect()`, `revalidatePath()`) que hoy apuntan a las rutas
   viejas.
5. Conservar el comportamiento de datos exactamente igual: esta fase
   es de navegación/estructura, no de permisos de datos — eso ya lo
   resuelve RLS desde la Fase 1. No agregues ni quites ninguna
   restricción de qué ve cada rol, solo reorganiza cómo se llega ahí.

## Fuera de alcance — NO tocar en esta fase

- Nada de base de datos, RLS, ni vistas — eso ya cerró en la Fase 1.
- Onboarding de negocio nuevo (Fase 4).
- Panel superadmin (Fase 5).
- Rediseño visual más allá de lo estrictamente necesario para unificar
  la navegación (el pulido general de diseño es la Fase 7).

## Casos límite a resolver

- Cajera que intenta entrar a una URL de admin escribiéndola a mano —
  ya cubierto arriba, pero dime explícitamente cómo lo probaste.
- Usuario con sesión vencida o sin perfil válido (el mismo caso que ya
  resolvimos en la Fase 1: nunca "ver todo" ni "ver nada en silencio",
  siempre un bloqueo claro).
- Enlaces guardados o compartidos (por ejemplo, un enlace directo a
  una venta específica) que usaban la ruta vieja — decide si
  redirigen a la nueva o si de plano cambian, y anótalo.
- Pantallas que hoy son visualmente distintas entre admin y empleado
  para la misma acción (por ejemplo, desposte) — no las fusiones a la
  fuerza si el flujo de trabajo es genuinamente distinto; unifica la
  *navegación*, no necesariamente cada pantalla individual si no tiene
  sentido de negocio.

## Verificación antes de dar la fase por cerrada

1. Build limpio (`tsc`, ESLint, build) como siempre.
2. Con el usuario real de Carnegüey (admin): confirmar que todo el
   flujo de negocio sigue funcionando igual que antes (compras, POS,
   cuadre, nómina).
3. Con un usuario cajera de prueba: confirmar que ve solo lo que le
   corresponde, y que intentar entrar a una URL de admin la rebota.
4. Repetir la prueba con el usuario de la organización "Prueba" que ya
   existe, para confirmar que la Fase 2 no rompió el aislamiento de la
   Fase 1 (esto es solo para estar seguros — no debería tocarse nada
   de eso, pero es gratis verificarlo).

## Al terminar

Resumen en lenguaje de negocio: qué cambió en la navegación, cuántas
pantallas se movieron o fusionaron, y qué debo probar yo mismo antes
de seguir a la Fase 3 (báscula universal).
