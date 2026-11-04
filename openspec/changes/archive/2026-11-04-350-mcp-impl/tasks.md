# Tasks: 350-mcp-impl

## 1. Implementación MCP
- [x] 1.1 Crear `src/mcp/types.ts` con tipos de configuración, herramientas, esquemas y clientes.
- [x] 1.2 Crear `src/mcp/cliente.ts` con protocolo JSON-RPC stdio, inicialización, llamadas, timeout y cierre sin procesos huérfanos.
- [x] 1.3 Crear `src/mcp/gestor.ts` con conexión bajo demanda, orden estable, validación de argumentos, truncado y sanitización.
- [x] 1.4 Crear `src/mcp/permisos.ts` y visibilidad por agente en `src/mcp/index.ts`.
- [x] 1.5 Exportar módulo en `src/mcp/index.ts`.

## 2. Integración y Pruebas
- [x] 2.1 Conectar validación en configuración y arranque.
- [x] 2.2 Implementar `tests/mcp/mcp.test.ts` con los 27 escenarios de `openspec/specs/mcp/spec.md`.
- [x] 2.3 Validar con `npm run check` y archivar change.
