# Design: 340-lsp-impl

## Componentes

1. `src/lsp/types.ts`:
   - Tipos de configuración de servidores LSP (`ConfiguracionServidorLsp`).
   - Tipos de operaciones LSP: `OperacionLsp` (`definition`, `references`, `documentSymbols`, `workspaceSymbols`, `hover`, `diagnostics`).
   - Ubicaciones, diagnósticos y resultados formateados.
2. `src/lsp/cliente.ts`:
   - `ClienteLsp`: comunicación JSON-RPC con cabeceras `Content-Length:` estándar de LSP sobre stdio / procesos hijo.
   - Handshake `initialize`, notificaciones `didOpen`, `didChange`, `didClose`, y métodos `textDocument/definition`, `textDocument/references`, `textDocument/documentSymbol`, `workspace/symbol`, `textDocument/hover`, `textDocument/diagnostic`.
   - Cierre ordenado (`shutdown`, `exit`, `kill`).
3. `src/lsp/gestor.ts`:
   - `GestorLsp`: resuelve servidores por extensión/lenguaje, administra arranque bajo demanda, cachea diagnósticos y maneja cierre sin procesos huérfanos.
   - Provee método `obtenerDiagnosticosDeArchivo(ruta)` para feedback post-edición.
4. `src/lsp/herramienta.ts`:
   - Herramienta de solo lectura `lsp` con esquema zod validado para operaciones por símbolo y texto.
   - Validación de argumentos y retorno de errores como texto.
   - Integración con portero de permisos (acción `lsp`, recurso `<operacion>:<ruta>`).
