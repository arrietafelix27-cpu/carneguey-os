# Pulido — Compras y Desposte (Miura)

## Contexto para ti, Claude Code

Fases 1, 2 y 3 cerradas (multi-negocio, app unificada, báscula
universal). Ahora entramos a una etapa distinta: no construir algo
nuevo, sino **revisar a fondo el módulo que ya existe** — compras,
lotes, desposte, sub-despostes y transferencias — y dejarlo
completamente terminado antes de pasar al siguiente grupo (ventas y
clientes).

Este es el diferenciador real del producto (control de merma), así
que el estándar aquí es más alto que en el resto de la app.

## Cómo trabajar esta revisión

No es una lista de features a construir — es una auditoría. Recorre
cada pantalla de este grupo (lista abajo) poniéndote en el lugar de un
dueño de carnicería que nunca usó la app, y del lado de la cajera
también donde aplique. Para cada pantalla, revisa:

1. **¿El flujo se puede completar de principio a fin sin atascarse?**
   Prueba los caminos normales y los raros (cancelar a mitad, volver
   atrás, cerrar y volver a entrar).
2. **¿Los mensajes de error son claros en español de carnicería**, no
   en lenguaje técnico ni códigos crípticos?
3. **¿Falta alguna validación obvia?** (por ejemplo: registrar un peso
   negativo, un lote sin proveedor, un desposte que no cuadra).
4. **¿La cajera puede ver o hacer algo que no debería** (costos,
   márgenes, valor de inventario), o le falta algo que sí necesita
   para hacer su trabajo?
5. **¿Hay pasos confusos o de más** que un dueño no técnico no
   entendería sin que tú se lo expliques?

## Pantallas de este grupo

**Admin:**
`compras-directas/[id]`, `conteo/nuevo`, `conteos`, `conteos/[id]`,
`despostes/[id]`, `entradas`, `inventario`, `lotes/[id]`,
`lotes/activos`, `lotes/nuevo-en-pie`, `sub-despostes`,
`transferencias`

**Empleado:**
`compras/canal-directo`, `compras/cerdo`, `compras/corte-directo`,
`compras/llegada-canales`, `compras/otros`, `compras/pollo`,
`compras/pollo/desposte`, `compras/pollo/directos`, `desposte`,
`desposte/[id]`, `procesos`, `sub-desposte`, `transferencias`

## Qué hacer con lo que encuentres

- **Arreglos chicos y de bajo riesgo** (mensaje de error confuso,
  validación obvia que falta, texto que no es claro): arréglalos
  directo, sin preguntar uno por uno — anótalos en la lista final.
- **Cualquier cosa que cambie el comportamiento de negocio** (qué se
  permite o no, cómo se calcula algo, qué ve cada rol): NO la cambies
  sin más — anótala en una lista separada de "decisiones para Félix",
  con la pregunta concreta que necesitas que te responda.
- **No agregues funciones nuevas** que no existían — esto es pulir lo
  que hay, no expandir el alcance. Si ves una oportunidad clara de
  mejora que valga la pena, anótala aparte como sugerencia, no la
  construyas sin luz verde.

## Verificación

Build limpio como siempre. Además, antes de darlo por cerrado, corre
tú mismo los flujos completos de extremo a extremo al menos una vez
cada uno (comprar un lote → recibirlo → despostarlo → ver el
inventario reflejar la merma) para confirmar que la cadena completa
funciona, no solo cada pantalla por separado.

## Al terminar

Dame tres listas, en lenguaje de negocio:
1. Qué arreglaste ya (sin que yo tenga que decidir nada).
2. Qué decisiones necesitas que tome (con la pregunta concreta de
   cada una).
3. Ideas de mejora que viste pero no construiste, por si vale la pena
   más adelante.
