# Tasks

## 1. Metadato de paralelo

- [ ] 1.1 Agregar a la definición de herramienta el campo que declara si admite paralelo.
- [ ] 1.2 Tratar la ausencia del campo como no segura.
- [ ] 1.3 Declarar seguras a `read`, `glob` y `grep`.
- [ ] 1.4 Declarar no seguras a `write`, `edit`, `shell` y `subagent`.
- [ ] 1.5 Test del catálogo: toda herramienta declara el campo y las de efecto son seriales.

## 2. Agrupación

- [ ] 2.1 Recorrer las llamadas en orden y abrir una tanda con las consecutivas seguras.
- [ ] 2.2 Cerrar la tanda abierta ante una llamada no segura y ejecutarla sola.
- [ ] 2.3 No reordenar llamadas: la tanda se arma con lo que vino contiguo.
- [ ] 2.4 Test: `[read, read, read, edit, shell, read]` produce cuatro tandas.
- [ ] 2.5 Test: un `read` posterior a un `edit` ve el archivo editado.

## 3. Ejecución de la tanda

- [ ] 3.1 Ejecutar las llamadas de una tanda con `Promise.allSettled`.
- [ ] 3.2 Convertir cada rechazo en el texto de error de esa herramienta.
- [ ] 3.3 No cancelar las demás llamadas cuando una falla.
- [ ] 3.4 Abortar las llamadas en vuelo al cancelar el turno.
- [ ] 3.5 Dar un resultado de cancelación a las llamadas abortadas.

## 4. Historial e interfaz

- [ ] 4.1 Agregar los resultados en orden de llamada, no de finalización.
- [ ] 4.2 Verificar que cada llamada tiene exactamente un resultado después del turno.
- [ ] 4.3 Mostrar todas las tarjetas de la tanda al empezar.
- [ ] 4.4 Completar cada tarjeta cuando su llamada termina, sin reordenarlas.

## 5. Permisos

- [ ] 5.1 Evaluar el permiso de todas las llamadas de la tanda antes de ejecutarla.
- [ ] 5.2 Si alguna requiere aprobación, esperar la decisión antes de ejecutar la tanda.
- [ ] 5.3 Denegar solo la llamada denegada; las demás entregan su resultado.
- [ ] 5.4 Test: una tanda con una llamada en espera no ejecuta ninguna hasta la decisión.

## 6. Tests

- [ ] 6.1 Un test por cada escenario de los deltas de `core`, `tools` e `interface`.
- [ ] 6.2 Test de que el orden del historial no depende del tiempo de finalización.
- [ ] 6.3 Test de cancelación de una tanda en vuelo.
- [ ] 6.4 Correr `npm run check` en verde.

## 7. Cierre

- [ ] 7.1 Verificar que `170-permisos` está archivado antes de archivar este change.
- [ ] 7.2 Actualizar los conteos de `AGENTS.md` y `openspec/config.yaml` al archivar.
