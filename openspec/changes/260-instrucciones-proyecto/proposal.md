# Proposal

## Why

Hoy el harness arranca sin saber nada del proyecto: el prompt base es genérico y
nunca lee `AGENTS.md`. Cada sesión hay que repetir a mano las convenciones, los
comandos de verificación y la estructura del repo. Es la primera pieza del
Nivel 8 y no necesita hooks, escritura ni un formato nuevo: alcanza con leer el
archivo que el proyecto ya tiene.

## What Changes

- Nueva capacidad `instructions`: al construir la sesión se lee
  `<proyecto>/AGENTS.md` una vez y se inyecta en el prompt de sistema, después
  del prompt base y antes del prompt del agente.
- Si el archivo no existe o está vacío, la sesión arranca igual y el prompt no
  cambia.
- Tope configurable con valor por defecto de 32 KiB: si `AGENTS.md` lo supera,
  el arranque falla con un mensaje que nombra el archivo, su tamaño y el tope.
  No se trunca.
- `context`: el conteo estimado del presupuesto incluye el prompt de sistema,
  para que el costo de las instrucciones no quede invisible.
- Fuera de alcance: `memoria/`, `AGENTS.md` anidados, recarga en caliente,
  escritura de memoria, skills y auto-extracción al cerrar sesión.

## Capabilities

### New Capabilities

- `instructions`: carga de las instrucciones del proyecto al arrancar, con tope
  que falla en vez de truncar y conservación durante la sesión.

### Modified Capabilities

- `context`: el conteo estimado del presupuesto incluye el prompt de sistema.

## Impact

- Código: `src/instructions/` (nuevo), `src/app.ts`, `src/context/metrics.ts`,
  `src/interface/runner.ts`.
- Pruebas: `tests/instructions/` (nuevo) y los fixtures de métricas existentes.
- Documentación: `docs/comportamiento.md`, `AGENTS.md`, `openspec/config.yaml`,
  `PREGUNTAS.md` y `alcance/nivel-8-memoria.md`.
- Sin dependencias nuevas y sin configuración obligatoria: un proyecto sin
  `AGENTS.md` se comporta exactamente como hoy.
