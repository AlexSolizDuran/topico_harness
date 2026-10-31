# Design

## Context

Hoy `src/core/loops.ts` cuenta las llamadas consecutivas con la misma herramienta
y los mismos argumentos canónicos. Al llegar a tres devuelve un mensaje de
bloqueo, y `src/core/batches.ts` lo usa para no despachar la llamada. El bloqueo
es defensivo, pero no es un permiso: no pasa por el portero, no muestra una
solicitud y no deja que la persona decida.

El spec de `core` describe exactamente ese bloqueo. El de `permissions` enumera
las acciones y las operaciones que siempre piden aprobación, pero no incluye la
repetición. `interface` ya sabe mostrar una aprobación obligatoria con acción,
recurso y motivo, y ya limita las opciones a aprobar una vez o denegar.

## Goals / Non-Goals

**Goals:**

- Convertir la repetición idéntica en una aprobación obligatoria.
- Mantener el conteo, la comparación canónica de argumentos y el reinicio por
  cambio de firma.
- Definir qué pasa al aprobar, al denegar, sin terminal y sin portero.
- Dar a la repetición una acción propia en el vocabulario de permisos.

**Non-Goals:**

- Implementar el cambio en `src/` o agregar tests en este change.
- Cambiar la interfaz de aprobación.
- Endurecer `normalizarAccionPermiso` ni el manejo de reglas mal formadas.
- Cambiar el límite de pasos.

## Decisions

**La repetición es un permiso, no un error.** La tercera llamada idéntica no se
ejecuta sin una decisión. Aprobar una vez la ejecuta; denegar devuelve el rechazo
al modelo como texto. Así el turno no se corta y la persona conserva la decisión
que hoy le quita el bloqueo duro.

**El recurso es el nombre de la herramienta.** Una regla `doom_loop` sobre `read`
gobierna las repeticiones de `read`. Es simple, no expone argumentos que podrían
contener secretos y alcanza para el caso de uso. La firma completa se sigue usando
para contar, pero no como recurso de permiso.

**La aprobación es por llamada, no por firma.** Si se aprueba la tercera, la
cuarta idéntica vuelve a pedir aprobación. Aprobar una vez no debe convertirse en
un “aprobar siempre” encubierto. La opción `siempre` no existe para una aprobación
obligatoria.

**Denegar bloquea la firma hasta que cambie.** Después de denegar, la misma
herramienta con los mismos argumentos no se vuelve a ejecutar ni a preguntar,
aunque otra llamada se intercale. El bloqueo se libera cuando cambia la
herramienta o un argumento. El conteo consecutivo se reinicia igual, pero el
bloqueo de la firma denegada persiste.

**Una sola solicitud cuando la herramienta también pide aprobación.** Si la
llamada repetida ya requiere aprobación por su propio riesgo, el sistema no pide
dos veces. Emite una solicitud obligatoria que combina el motivo de repetición y
el motivo de la herramienta.

**Sin terminal se deniega; sin portero se mantiene el bloqueo.** Son los mismos
fallbacks defensivos que ya usa el resto del harness. La ausencia de una decisión
no habilita la ejecución.

**No se cambia `interface`.** La aprobación obligatoria existente ya muestra
acción, recurso y motivo, y ya ofrece solo aprobar una vez o denegar. Agregar un
delta de interfaz duplicaría una garantía que ya está escrita.

## Risks / Trade-offs

- [Preguntar en cada repetición puede ser molesto] → Es el precio de no convertir
  “una vez” en “siempre”; el modelo puede cambiar de estrategia o de argumentos.
- [El bloqueo de firma denegada sobrevive a llamadas intermedias] → Es más
  estricto que el conteo actual, pero evita que una llamada de relleno desbloquee
  la misma repetición.
- [El spec queda adelante del código] → El change de implementación y sus tests
  se derivan después; este change solo fija el contrato.
- [Una regla `doom_loop` no distingue argumentos] → Se acepta a cambio de reglas
  simples y de no exponer argumentos sensibles.

## Migration Plan

No hay migración. Los specs cambian, el comportamiento no. Para volver atrás
alcanza con descartar el change.
