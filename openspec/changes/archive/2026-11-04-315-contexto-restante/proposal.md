# Proposal: Implementación de requisitos pendientes de contexto, provider, tools e interface

## Why

Las capacidades `context`, `provider`, `tools` e `interface` ya tienen especificados requisitos clave para robustecer la ejecución:
- `context`: Inyección de recordatorios de sistema (tras edición para sugerir verificar, tras pasos sin escribir para reinyectar el objetivo, y tras compactar) conservando el objetivo original y sin romper la atomicidad.
- `provider`: Prefijo estable de la petición (prompt de sistema inmutable durante el turno, orden determinista e inmutable de herramientas independiente de permisos, y compactación solo al final del turno para favorecer el prompt caching del LLM).
- `tools`: Entrega de salida de ejecución como cola (últimos N caracteres con marcador de caracteres omitidos y referencia a la interfaz) en vez de truncado de cola o mezcla de salidas.
- `interface`: Conservación de la salida completa de la herramienta de ejecución en la TUI/historial visual incluso cuando el modelo recibe la cola recortada.

## What Changes

- `src/context/`:
  - Módulo de recordatorios de sistema (`reminders.ts`): gestiona recordatorio post-edición, recordatorio por inactividad de escritura con umbral configurable de pasos, y recordatorio post-compactación.
  - Almacenamiento del objetivo original fuera del historial compactable.
  - Integración en el loop/dispatch de turnos respetando la atomicidad llamada-respuesta.
- `src/provider/`:
  - Ordenamiento estable y determinista del catálogo de herramientas enviado al provider.
  - Estabilidad del prompt de sistema durante todo el turno.
- `src/tools/`:
  - Ajuste en `shell.ts` y truncado para formatear la salida larga como cola (tail) con marcador `[... N caracteres omitidos. La salida completa está disponible en la interfaz ...]` manteniendo el final de la salida o error.
- `src/interface/`:
  - Retención de la salida completa sin recortar en el estado visual / eventos de la interfaz para que el usuario consulte el texto íntegro mientras el modelo ve la cola.
- Tests completos para los 20 escenarios correspondientes.

## Capabilities

### Modified Capabilities

- `context`: Recordatorios de sistema y preservación del objetivo original.
- `provider`: Prefijo estable en peticiones del turno.
- `tools`: Salida de ejecución como cola.
- `interface`: Salida de ejecución completa preservada en la interfaz.

## Impact

- Código en `src/context/`, `src/provider/`, `src/tools/`, `src/interface/`, `src/core/`.
- Tests unitarios y de integración para cada uno de los 20 escenarios en sus respectivas suites.
- Sin dependencias externas adicionales.
