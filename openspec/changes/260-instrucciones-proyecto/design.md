# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- `construirHarness` (`src/app.ts`) es el único lugar que arma la sesión: ahí se
  conoce el directorio del proyecto y se compone el prompt de sistema.
- `SesionInteractiva` guarda `promptSistemaBase` y lo combina con el prompt del
  agente en `componerPromptEfectivo`. Reanudar una sesión y cambiar de agente
  pasan por ese mismo método, así que la memoria del prompt base se conserva sin
  código extra.
- `ejecutarTurno` recibe `sistema` y lo envía al provider en cada paso del loop.
  No hay caché local del request: el prompt viaja completo cada vez.
- El conteo del presupuesto vive en `src/context/` y hoy ignora el prompt de
  sistema. Cuando el provider reporta tokens, ese número ya incluye el prompt;
  cuando se estima, no.

## Goals / Non-Goals

**Goals:**

- Leer `AGENTS.md` una sola vez, en el mismo punto donde se resuelve el
  directorio del proyecto.
- Fallar el arranque de forma visible y accionable cuando el archivo no cabe.
- Reflejar el costo real del prompt de sistema en el presupuesto estimado.

**Non-Goals:**

- Recarga en caliente: editar `AGENTS.md` con la sesión abierta no cambia el
  prompt. Se toma en la próxima sesión.
- Descubrimiento de `AGENTS.md` anidados. Requiere que las tools avisen qué
  carpeta exploran; es otro change.
- `memoria/`, escritura por el agente, skills y auto-extracción.

## Decisions

**Capacidad nueva `instructions`, no un requisito de `context`.** `context` mide
y recorta; `instructions` decide qué contexto estable entra. Son ciclos de vida
distintos y el contrato se lee mejor separado. Alternativa descartada: colgarlo
de `context`, que habría mezclado "qué se inyecta" con "cuánto cabe".

**Leer en `construirHarness`, no en `SesionInteractiva`.** `construirHarness` ya
recibe `directorioProyecto` y es el punto donde se puede fallar antes de crear
una sesión a medias. Alternativa descartada: leer dentro del runner, que
arrastraría el filesystem a la interfaz.

**Composición `base → instrucciones → agente`.** El prompt del agente queda al
final para que pueda especializar sin borrar el contrato del proyecto. OpenCode
hace lo inverso (agente primero); se descartó porque acá el prompt del agente es
corto y especializa, mientras que `AGENTS.md` es la norma del repo.

**Tope en bytes, no en líneas.** 32 KiB por defecto, configurable. En bytes
porque el costo real es de tokens y el tamaño en disco es la única medida
estable antes de tokenizar. Alternativa descartada: contar líneas, que castiga
líneas largas y no dice nada del costo.

**El error se lanza, no se devuelve como aviso.** El arranque no tiene una sesión
donde mostrar un aviso; si el archivo no cabe, la sesión no debe existir. El
mensaje nombra archivo, tamaño y tope para que se pueda corregir sin adivinar.

**Contar el prompt de sistema solo en la rama estimada.** El conteo del provider
ya incluye el prompt completo; sumarlo otra vez inflaría el uso. La estimación
propia sí tiene que sumarlo. Se implementa como un campo `tokensSistema` en las
métricas y un parámetro opcional en `medirContexto`, para no romper a los
llamadores existentes.

**Sin configuración obligatoria.** Un proyecto sin `AGENTS.md` no cambia en nada.
El tope se puede ajustar, pero el valor por defecto alcanza para este repo
(17 KiB).

## Risks / Trade-offs

- [Un `AGENTS.md` grande se envía en cada paso del turno] → Es el costo de tener
  contexto estable; el tope y el conteo lo hacen visible en vez de silencioso.
- [Fallar el arranque por tamaño puede sorprender] → El mensaje dice cuánto
  sobra; es preferible a truncar y que el agente crea que leyó algo que no leyó.
- [El conteo estimado sigue siendo aproximado] → Se mantiene la marca de
  "estimado" que ya existe; no se presenta como exacto.
- [Cambiar el prompt base puede alterar el comportamiento de los tests de interfaz] → Los tests que comparan el prompt usan proyectos temporales sin `AGENTS.md`, así que no cambian.

## Migration Plan

No hay migración: es una capacidad nueva y opt-in por presencia del archivo. Para
volver atrás alcanza con no tener `AGENTS.md` en la raíz del proyecto.
