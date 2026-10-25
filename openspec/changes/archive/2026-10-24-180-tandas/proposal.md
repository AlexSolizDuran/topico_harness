# Proposal

## Why

El modelo ya devuelve varias llamadas a herramientas en un solo mensaje, pero el
turno las ejecuta una detrás de otra con un `for` y un `await`. Leer diez archivos
son diez esperas encadenadas aunque no dependan entre sí.

Paralelizar todo sería peor: un `read` después de un `edit` vería el archivo viejo.
La concurrencia tiene que respetar el orden en que el modelo pidió las cosas.

## What Changes

- El despacho agrupa las llamadas **consecutivas** cuyas herramientas admiten
  paralelo y las ejecuta en una tanda.
- Una llamada que no admite paralelo corta la tanda y se ejecuta sola.
- Cada herramienta declara si admite paralelo; sin declaración se asume que no.
- Los resultados se guardan en orden de llamada, no de finalización.
- Un fallo no cancela el resto de la tanda.
- Una aprobación pendiente frena la tanda antes de ejecutarla.
- Cancelar aborta las llamadas en vuelo y cada llamada conserva su resultado.
- La interfaz muestra todas las tarjetas de la tanda al empezar y las completa a
  medida que terminan.

## Capabilities

### Modified Capabilities

- `core`: el despacho agrupa por tandas; la tanda conserva el orden y entrega un
  resultado por llamada.
- `tools`: cada herramienta declara si admite ejecución en paralelo.
- `interface`: la tanda muestra todas sus tarjetas desde el inicio.

## Impact

- `src/core/turn.ts`: reemplazar el `for` secuencial por agrupación y ejecución por
  tandas.
- `src/core/registry.ts`: metadato de paralelo por herramienta.
- `src/tools/*.ts`: declarar paralelo en leer, buscar archivos y buscar texto;
  serial en escribir, editar, ejecutar y delegar.
- `src/interface/`: tarjetas simultáneas y actualización por finalización.
- `tests/core/` y `tests/interface/`.

## Dependencia

El texto del despacho se apoya en `170-permisos`, que agrega la consulta de permiso
antes de ejecutar. Al archivar, el orden es `150`, `160`, `170`, `180`, `190`.
