# Proposal

## Why

Un modelo trabado repite la misma llamada con los mismos argumentos. El harness la
ejecuta una y otra vez, gasta pasos y tokens, y no cambia nada: el resultado es
idéntico. El límite de pasos lo corta recién a los 25, cuando el turno ya se
perdió.

El harness puede notarlo antes: si la llamada es idéntica a la anterior y la
anterior no cambió nada, ejecutarla de nuevo no aporta información.

## What Changes

- El turno cuenta las llamadas consecutivas con el mismo nombre y los mismos
  argumentos.
- Al llegar a tres, la tercera no se ejecuta y vuelve al modelo como texto.
- El conteo se reinicia si cambia la herramienta, cambia un argumento o hay otra
  llamada en el medio.
- El bloqueo no termina el turno: el modelo puede corregir y seguir.
- El bloqueo queda en el historial junto a su llamada.

## Capabilities

### Modified Capabilities

- `core`: nuevo requisito de repetición idéntica consecutiva.

## Impact

- `src/core/turn.ts`: contador por turno y comparación canónica de argumentos.
- `tests/core/`: un test por escenario.

## Dependencia

Independiente de `180-tandas` en el texto, pero comparte el bucle: el conteo se hace
sobre las llamadas pedidas por el modelo, antes de agrupar. Al archivar, va después
de `180`.
