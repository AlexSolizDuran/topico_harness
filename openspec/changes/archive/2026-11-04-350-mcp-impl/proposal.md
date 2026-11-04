# Proposal: 350-mcp-impl

## Why
El spec `mcp` define la integración con servidores MCP externos para expandir las capacidades del harness con herramientas externas bajo demanda, garantizando aislamiento de fallos, orden estable, validación de esquemas, sanitización, permisos y visibilidad granular por perfil de agente.

## What
Implementar el módulo `src/mcp/` conforme a `openspec/specs/mcp/spec.md`:
1. Declaración y registro de servidores en la configuración (`servidoresMcp`).
2. Conexión bajo demanda (stdio transport/proceso) y descubrimiento de herramientas con prefijo `<servidor>_<herramienta>`.
3. Ejecución con validación de esquema, timeout (30s por defecto), truncado y sanitización de credenciales.
4. Resiliencia: fallos de servidor (crash, timeout, spawn error) devueltos como texto sin abortar el turno ni dejar procesos huérfanos.
5. Permisos: acción `mcp` y recurso `<servidor>/<herramienta>`, elevación a aprobación obligatoria ante riesgos declarados.
6. Filtrado y visibilidad por agente (`mcpServers`).
