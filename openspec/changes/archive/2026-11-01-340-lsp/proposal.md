# Proposal

## Why

El Nivel 7 sigue abierto en su integración de código. Hoy el agente busca con
`grep` y `glob`: encuentra 200 coincidencias donde un servidor de lenguaje
encontraría 4, y no distingue definición, uso y código muerto. Tampoco se entera
de un error de tipos hasta que corre una prueba.

El ciclo más corto posible es que el diagnóstico vuelva al agente después de
editar, sin que la persona corra nada.

## What Changes

- Nueva capacidad `lsp`: servidores de lenguaje declarados en la configuración.
- Operaciones expuestas: definición, referencias, símbolos de documento, símbolos
  de workspace, hover y diagnósticos.
- Diagnósticos automáticos después de una edición, devueltos al agente como texto
  y limitados a los archivos modificados.
- Degradación limpia: sin servidor disponible, la operación falla como texto y el
  turno sigue; el agente puede volver a `grep` y `glob`.
- La herramienta es de solo lectura y puede formar parte de la intersección de un
  subagente si su definición la declara.
- `permissions`: se suma la acción de leer símbolos, con la operación y el archivo
  como recurso.
- Ciclo de vida: arranque bajo demanda y cierre al terminar la sesión o el turno
  hijo, sin procesos huérfanos.
- Fuera de alcance: implementar el comportamiento, empaquetar servidores de
  lenguaje, MCP y diagnósticos de todo el workspace en cada paso.

## Capabilities

### New Capabilities

- `lsp`: servidores de lenguaje, operaciones por símbolos, diagnósticos y ciclo de
  vida.

### Modified Capabilities

- `permissions`: nueva acción de permiso para leer símbolos.

## Impact

- Solo specs: `openspec/specs/lsp/spec.md` y
  `openspec/specs/permissions/spec.md`.
- Sin cambios en `src/`, `tests/` ni `docs/comportamiento.md`.
- La implementación futura reusa el registro de herramientas y el portero de
  permisos; no requiere una dependencia nueva en el contrato.
- Al archivar, actualizar los conteos de `AGENTS.md` y `openspec/config.yaml`;
  esa higiene va en `360-higiene-alcance`.
