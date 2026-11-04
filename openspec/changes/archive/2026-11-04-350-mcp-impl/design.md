# Design: 350-mcp-impl

## Componentes

1. `src/mcp/types.ts`:
   - Interfaces para configuración (`ConfiguracionServidorMcp`), herramientas (`HerramientaMcp`), estado de cliente y procesos.
2. `src/mcp/cliente.ts`:
   - Conexión JSON-RPC sobre stdio / proceso hijo con manejo de lifecycle (spawn, handshake/initialize, listTools, callTool, shutdown/kill).
   - Manejo de timeouts (30s) y reintentos en turnos posteriores si falla.
3. `src/mcp/registro.ts`:
   - `GestorMcp`: administra servidores declarados, conexión bajo demanda la primera vez que se consulta o invoca una herramienta del servidor.
   - Preserva orden estable (las herramientas del nuevo servidor se agregan al final).
   - Valida esquemas de argumentos (Zod / JSON Schema validation).
   - Aplica truncado (`formatearColaSalida`) y sanitización de credenciales (`credencialesSanitizar`).
4. `src/mcp/permisos.ts`:
   - Mapeo de acción `mcp` y recurso `<servidor>/<herramienta>`.
   - Soporte para herramientas con riesgo declarado elevando a aprobación obligatoria.
5. `src/mcp/agente.ts`:
   - Filtrado de herramientas MCP basado en la declaración de servidores del agente y reglas denegar.
