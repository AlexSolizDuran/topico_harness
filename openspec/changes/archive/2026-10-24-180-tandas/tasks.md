# Tasks

## 1. Metadato de paralelo

- [x] 1.1 Agregar a la definición de herramienta el campo que declara si admite paralelo.
- [x] 1.2 Tratar la ausencia del campo como no segura.
- [x] 1.3 Declarar seguras a `read`, `glob` y `grep`.
- [x] 1.4 Declarar no seguras a `write`, `edit`, `shell` y `subagent`.
- [x] 1.5 Test del catálogo: toda herramienta declara el campo y las de efecto son seriales.

## 2. Agrupación

- [x] 2.1 Recorrer las llamadas en orden y abrir una tanda con las consecutivas seguras.
- [x] 2.2 Cerrar la tanda abierta ante una llamada no segura y ejecutarla sola.
- [x] 2.3 No reordenar llamadas: la tanda se arma con lo que vino contiguo.
- [x] 2.4 Test: `[read, read, read, edit, shell, read]` produce cuatro tandas.
- [x] 2.5 Test: un `read` posterior a un `edit` ve el archivo editado.

## 3. Ejecución de la tanda

- [x] 3.1 Ejecutar las llamadas de una tanda con `Promise.allSettled`.
- [x] 3.2 Convertir cada rechazo en el texto de error de esa herramienta.
- [x] 3.3 No cancelar las demás llamadas cuando una falla.
- [x] 3.4 Abortar las llamadas en vuelo al cancelar el turno.
- [x] 3.5 Dar un resultado de cancelación a las llamadas abortadas.

## 4. Historial e interfaz

- [x] 4.1 Agregar los resultados en orden de llamada, no de finalización.
- [x] 4.2 Verificar que cada llamada tiene exactamente un resultado después del turno.
- [x] 4.3 Mostrar todas las tarjetas de la tanda al empezar.
- [x] 4.4 Completar cada tarjeta cuando su llamada termina, sin reordenarlas.

## 5. Permisos

- [x] 5.1 Evaluar el permiso de todas las llamadas de la tanda antes de ejecutarla.
- [x] 5.2 Si alguna requiere aprobación, esperar la decisión antes de ejecutar la tanda.
- [x] 5.3 Denegar solo la llamada denegada; las demás entregan su resultado.
- [x] 5.4 Test: una tanda con una llamada en espera no ejecuta ninguna hasta la decisión.

## 6. Tests

- [x] 6.1 Un test por cada escenario de los deltas de `core`, `tools` e `interface`.
- [x] 6.2 Test de que el orden del historial no depende del tiempo de finalización.
- [x] 6.3 Test de cancelación de una tanda en vuelo.
- [x] 6.4 Correr `npm run check` en verde.

## 7. Cierre

- [x] 7.1 Verificar que `170-permisos` está archivado antes de archivar este change.
- [x] 7.2 Actualizar los conteos de `AGENTS.md` y `openspec/config.yaml` al archivar.
