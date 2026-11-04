# Tasks: 340-lsp-impl

## 1. Implementación LSP
- [x] 1.1 Crear `src/lsp/types.ts` con definiciones de configuración, operaciones y diagnósticos.
- [x] 1.2 Crear `src/lsp/cliente.ts` con protocolo JSON-RPC con Content-Length, arranque bajo demanda y shutdown.
- [x] 1.3 Crear `src/lsp/gestor.ts` para resolución por lenguaje/extensión, feedback post-edición y cierre de sesión.
- [x] 1.4 Crear `src/lsp/herramienta.ts` con la herramienta `lsp`, validación de esquemas y evaluación de permisos.
- [x] 1.5 Exportar módulo en `src/lsp/index.ts`.

## 2. Pruebas y Validación
- [x] 2.1 Implementar `tests/lsp/lsp.test.ts` con los 27 escenarios de `openspec/specs/lsp/spec.md`.
- [x] 2.2 Validar con `npm run check` y archivar change.
