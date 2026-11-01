# Design

## Context

Ver `proposal.md — Why`. Las piezas que ya existen y condicionan el diseño:

- `instructions` lee `AGENTS.md` al arrancar, aplica topes y lo inyecta como
  prompt de sistema. Es contexto estable, no aprendido.
- `hooks` ya dispara `sessionEnd`, que es el punto natural para la extracción.
- `context` mide el presupuesto e incluye el prompt de sistema en la estimación.
- `permissions` ya tiene la acción `edit`, que cubre escribir y editar archivos.
- La persistencia de sesiones es JSONL en `.harness/`; no hay base de datos.

## Goals / Non-Goals

**Goals:**

- Que lo aprendido en una sesión aparezca en la siguiente sin que la persona lo
  repita.
- Que la memoria sea legible, editable y acotada, no una caja negra.
- Que un error de memoria se vea: nunca truncar en silencio.

**Non-Goals:**

- Escribir memoria con el modelo principal ni con una llamada cara.
- Curación automática sin intervención humana.
- Sincronizar memoria entre máquinas o entre proyectos.
- Reemplazar `AGENTS.md` o el historial de la sesión.
- Implementar el comportamiento en `src/` o agregar tests en este change.

## Decisions

**Capacidad nueva `memory`, separada de `instructions`.** `instructions` es lo
estable y se escribe por decisión del equipo; `memory` es lo aprendido y cambia
por observación. Mezclarlas hace que las instrucciones envejezcan mal.
Alternativa descartada: colgar la memoria de `instructions`, que habría mezclado
dos ciclos de vida distintos.

**Archivos e índice, sin base de datos.** Un índice chico se carga siempre y los
detalles viven en archivos separados que se leen bajo demanda. Es el mismo
patrón que las skills: anuncio liviano y cuerpo bajo demanda. Alternativa
descartada: una base de datos, que agrega infraestructura sin resolver el
problema real, que es decidir qué merece guardarse.

**La memoria se inyecta como bloque de sistema marcado.** El modelo tiene que
saber que es memoria y no un hecho verificado de la conversación, igual que el
resumen de compactación. El bloque cuenta en el presupuesto y no se trunca en
silencio.

**La extracción corre al cerrar y usa un modelo barato.** Es una tarea de
resumir y filtrar, no de razonar. Se guardan convenciones, decisiones, errores ya
intentados y ubicaciones no obvias; se descarta lo que se deduce leyendo el
código. La escritura es atómica y un fallo no impide cerrar la sesión.

**El ámbito por defecto es el proyecto.** La memoria se va con el repo y se
comparte. La memoria de usuario existe para preferencias personales y nunca se
mezcla con la de un proyecto. Alternativa descartada: memoria global por defecto,
que contamina proyectos con preferencias ajenas.

**El tope falla, no trunca.** Truncar recuerdos en silencio es peor que no tener
memoria: la persona cree que el agente sabe algo y no lo sabe. El error nombra
archivo, tamaño y tope, y se puede corregir.

**La escritura directa del modelo usa la acción `edit`.** No hace falta una
acción de permiso nueva: la memoria vive en archivos del proyecto y el modelo ya
pasa por el gate de edición. La extracción automática es del harness, no una
llamada de herramienta.

## Risks / Trade-offs

- [La memoria se llena de ruido] → El índice es chico, el detalle va aparte y la
  extracción filtra lo deducible.
- [La memoria se pudre] → Cada entrada declara su origen y fecha; la curación es
  manual y visible.
- [La extracción con un modelo barato se equivoca] → Es una sugerencia editable,
  no una verdad incuestionable; la persona puede corregir el archivo.
- [El bloque de memoria consume contexto] → Cuenta en el presupuesto y sigue el
  mismo pipeline que el resto del historial.
- [El spec queda adelante del código] → El change de implementación y sus tests
  se derivan después; este change solo fija el contrato.

## Migration Plan

No hay migración. Un proyecto sin `memoria/` se comporta como hoy. Para volver
atrás alcanza con no tener el directorio de memoria o desactivar la extracción.
