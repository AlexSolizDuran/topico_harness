# Proposal: 340-lsp-impl

## Why
El spec `lsp` dota al agente de análisis semántico de código (definición, referencias, símbolos, hover, diagnósticos) y retroalimentación automática de diagnósticos post-edición, sin bloquear el turno ni dejar procesos huérfanos.

## What Changes
Implementar el módulo `src/lsp/` conforme a `openspec/specs/lsp/spec.md`:
1. Declaración y validación de servidores de lenguaje en la configuración (`servidoresLsp`).
2. Herramienta `lsp` de solo lectura con operaciones (`definition`, `references`, `documentSymbols`, `workspaceSymbols`, `hover`, `diagnostics`).
3. Diagnósticos automáticos post-edición para archivos modificados, formateados y truncados si exceden el límite.
4. Degradación graciosa: fallos devueltos como texto al modelo sin cancelar el turno ni bloquear la sesión.
5. Permisos de solo lectura con acción `lsp` y recurso `<operacion>:<archivo>`.
6. Cierre ordenado de procesos LSP al terminar la sesión o turno.
