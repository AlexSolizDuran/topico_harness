# Proposal

## Why

La compactación existe y cubre el camino normal, pero no garantiza el contrato en
los bordes. El presupuesto se valida al inicio del turno, no antes de cada paso;
después de compactar no se vuelve a medir; y una segunda compactación puede
acumular resúmenes. Un turno largo con muchas herramientas puede enviar una
petición por encima del límite aunque el pipeline de fin de turno funcione.

## What Changes

- Validar el presupuesto antes de cada petición del turno, incluidos los pasos
  intermedios, y recortar resultados viejos de herramientas si hace falta.
- Detener el turno con un mensaje claro si el historial sigue fuera del
  presupuesto después de recortar.
- Repetir la compactación hasta quedar bajo el límite o hasta que no queden
  turnos para resumir.
- Conservar un solo resumen automático: reemplazar el anterior en lugar de
  agregar otro.
- Mejorar el resumen determinista para conservar hechos ya resumidos, rutas con
  línea y correcciones observadas.
- Exponer las métricas de contexto para que la interfaz pueda mostrar el uso
  total y actual.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `context`: se modifican «El sistema mantiene un presupuesto de contexto con
  margen conservador» y «Cuando el recorte no alcanza el sistema resume el
  historial» para cubrir la validación entre pasos, la compactación repetida y
  el resumen único. Se agregan escenarios para esos bordes.

## Impact

- `src/core/turn.ts`: punto de preparación del historial antes de cada petición.
- `src/context/pipeline.ts`: compactación repetida y resultado de presupuesto.
- `src/context/compaction.ts`: resumen único y conservación de hechos previos.
- `src/context/metrics.ts` (nuevo): métricas de ventana, presupuesto y uso.
- `src/interface/runner.ts`: inyección de la preparación por paso y métricas.
- `tests/context/` y `tests/interface/session.test.ts`.
- `openspec/config.yaml` y `AGENTS.md` al cerrar el change.
