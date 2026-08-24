# Fase 3 — Báscula universal (Miura)

## Contexto para ti, Claude Code

Fases 1 y 2 cerradas: multi-negocio aislado y verificado, app unificada
con protección real por rol. Ahora toca que el POS funcione con la
báscula de **cualquier negocio**, no solo con el formato DIBAL 500-SW
que Carnegüey usa hoy.

Antes de empezar: lee `CLAUDE.md`, `docs/DECISIONS.md` (en particular
DT-002, sobre `pos_code`), y el archivo
`components/employee/pos-terminal.tsx` completo — ahí está hoy
hardcodeado el parseo del código de barras (prefijo fijo, posiciones
1-7 = código de producto, 7-13 = peso). Confírmame en un par de líneas
que entendiste cómo funciona hoy antes de tocar nada.

## El problema de fondo

Un ticket de báscula variable-peso codifica en el mismo código de
barras EAN-13 **dos cosas a la vez**: qué producto es, y cuánto pesa
ese corte específico (cambia en cada venta). Hoy Miura asume que sabe
de antemano en qué posiciones exactas del código vienen esos dos
datos, porque siempre fue la misma báscula. Eso deja de ser cierto en
cuanto entra un segundo negocio con otra marca.

## Objetivo de la fase

Que un negocio nuevo, **sin que el dueño entienda nada de códigos de
barras ni de báscula**, deje el sistema funcionando con su propia
báscula en minutos, así:

1. Al registrar (o editar) un producto, el dueño pesa ese producto en
   su báscula real, y escanea el ticket que salió con el mismo lector
   que va a usar en el punto de venta.
2. La primera vez que hace esto para su negocio, el sistema no sabe
   todavía cómo está armado el código de esa báscula — así que además
   de escanear, le pide **confirmar el peso real que muestra la
   báscula** (un número que el dueño ya tiene al frente, no algo que
   tenga que calcular). Con el código escaneado + el peso confirmado,
   el sistema **deduce solo** en qué posiciones del código vienen el
   peso y el código de producto, y guarda ese patrón para todo el
   negocio.
3. Del segundo producto en adelante, ya no hace falta confirmar el
   peso — solo escanear, porque el patrón del negocio ya se conoce.
4. En el POS, al escanear una venta, el sistema usa el patrón guardado
   de esa organización para separar código de producto y peso, igual
   que hace hoy pero de forma configurable en vez de fija.

## Alcance — qué SÍ entra en esta fase

1. Guardar, por organización, el patrón del código de barras: dónde
   empieza y cuántos dígitos ocupa el código de producto, dónde
   empieza y cuántos dígitos ocupa el peso, y en qué unidad viene el
   peso (gramos, decigramos, etc. — tú decides la representación más
   simple de mantener). Carnegüey debe migrar su patrón actual (el que
   hoy está fijo en el código) como el patrón guardado de su
   organización, para que nada le cambie.
2. La función que detecta el patrón a partir de "código escaneado +
   peso real confirmado por el dueño" — deja documentado en
   `DECISIONS.md` cómo decidiste resolver ambigüedades (por ejemplo,
   si el peso podría coincidir con más de una posición posible).
3. La pantalla donde el dueño pesa y escanea para dar de alta o editar
   el código de un producto — con el flujo de "primera vez pide
   confirmar peso, las siguientes no".
4. El POS deja de usar el parseo fijo y pasa a usar el patrón de la
   organización de quien tiene la sesión abierta.
5. Manejo explícito de cuando el patrón de una organización todavía no
   existe (negocio recién creado, ni un producto configurado aún): el
   POS no debe fallar en silencio ni con un error técnico — debe
   avisar con claridad que falta configurar el primer producto.
6. Resolver DT-002 de una vez: los productos de Carnegüey que hoy
   tienen `pos_code` vacío, dejarlos con su código real (usando el
   patrón ya migrado, no hace falta que Félix los vuelva a escanear
   uno por uno si el patrón ya se conoce y él ya tiene los códigos).

## Fuera de alcance — NO tocar en esta fase

- El catálogo de productos en sí (nombres, precios, categorías) — eso
  no cambia.
- Onboarding de negocio nuevo como flujo completo (Fase 4 quedó fuera
  del roadmap de v1 por decisión de Félix — los negocios nuevos los da
  de alta él a mano). Esta fase solo construye la pantalla de
  configurar el código de un producto, que Félix usará él mismo al
  dar de alta cada cliente.
- Facturación DIAN, panel superadmin — sin cambios.

## Casos límite a resolver

- Báscula que en vez de peso codifica **precio** en esa parte del
  código (existen modelos así en el mercado, aunquenoDIBAL no lo
  haga). Decide si lo cubres en esta fase o lo dejas anotado como
  fuera de alcance explícito en `DECISIONS.md` — no lo asumas
  silenciosamente.
- Código escaneado que no coincide con el patrón guardado de esa
  organización (por ejemplo, alguien escanea un código de otro
  producto por error durante la configuración) — debe rechazarse con
  un mensaje claro, no adivinar.
- Un producto sin código configurado todavía intenta venderse por
  escaneo en el POS — debe permitir entrada manual como respaldo
  (confirma si eso ya existe hoy o hay que agregarlo).
- Peso en cero o negativo por una mala lectura de báscula — ya validar
  que no se pueda registrar una venta así.

## Verificación antes de dar la fase por cerrada

1. Build limpio, como siempre.
2. Con el negocio de Carnegüey: confirmar que el POS sigue funcionando
   exactamente igual que antes (mismos productos, mismos códigos).
3. Simular un negocio nuevo (puedes usar la organización "Prueba" que
   ya existe): configurar un producto desde cero con el flujo de
   pesar+escanear+confirmar peso, y confirmar que un segundo producto
   ya no pide confirmar el peso.
4. Confirmar que un código de barras que no pertenece al patrón de esa
   organización se rechaza con un mensaje claro.

## Al terminar

Resumen en lenguaje de negocio: cómo quedó el flujo para configurar
una báscula nueva (para que yo mismo lo pruebe con calma antes de que
lo use un cliente real), qué tablas/funciones tocaste, y qué debo
revisar yo antes de seguir con el siguiente módulo (Compras y
desposte).
