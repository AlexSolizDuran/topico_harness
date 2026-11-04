# Proposal: Implementación de la Capacidad de Memoria Persistente

## Why

La memoria persistente permite al harness conservar contexto aprendido entre sesiones (decisiones, convenciones no obvias, errores previos) sin contaminar las instrucciones del proyecto (`AGENTS.md`) ni inflar el historial conversacional. La especificación en `openspec/specs/memory/spec.md` define 7 requisitos normativos y 29 escenarios que deben ser materializados en `src/memory/`.

## What Changes

- Creación del módulo `src/memory/`:
  - `almacen.ts`: Lectura y escritura del índice y detalle de memoria (`.harness/memory/index.md` y archivos de detalle) con validación de límites (32 KiB por archivo, 64 KiB total por defecto) y escrituras atómicas.
  - `inyector.ts`: Composición del bloque de memoria para el prompt de sistema con marcador explícito (`[Memoria del Proyecto]`), fecha y origen de entradas, cómputo en el presupuesto de tokens y soporte de memoria de usuario opcional con precedencia clara.
  - `extractor.ts`: Extracción automática de hechos no deducibles al cerrar sesión mediante modelo de bajo costo o simulado, descartando obviedades y asegurando que un fallo de extracción no impida el cierre de la sesión.
  - `curacion.ts`: Detección de obsolescencias y contradicciones, marcando entradas superadas.
- Integración en `SesionInteractiva` (`src/interface/runner.ts`) al iniciar la sesión y en `finalizarSesion` o `sessionEnd`.
- Suite completa en `tests/memory/memory.test.ts` cubriendo los 29 escenarios exactos de la especificación.

## Capabilities

### Modified Capabilities

- `memory`: Implementación completa de los 7 requisitos y 29 escenarios especificados.

## Impact

- Código nuevo en `src/memory/`.
- Integración ligera en `src/interface/runner.ts`.
- Tests en `tests/memory/memory.test.ts`.
- Sin dependencias externas nuevas.
