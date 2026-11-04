# Design: 330-sandbox-impl

## Componentes

1. `src/sandbox/types.ts`:
   - Configuración de sandbox (`ConfiguracionSandbox`).
   - `InformacionAislamiento` (`aislado: boolean`, `mecanismo?: string`, `motivoDegradacion?: string`, `directorioTemporal?: string`).
   - Resultado de comando aislado (`ResultadoEjecucionAislada`).
2. `src/sandbox/plataforma.ts`:
   - Detección de mecanismos disponibles (`bwrap`, `sandbox-exec`) según `process.platform`.
   - Manejo de degradación visible con motivo claro cuando no está disponible o está deshabilitado por configuración.
3. `src/sandbox/temporales.ts`:
   - `GestorTemporales`: crea directorios temporales aislados por ejecución y asegura su limpieza (incluso en cancelaciones o errores).
4. `src/sandbox/ejecutor.ts`:
   - Envuelve la ejecución de comandos aplicando argumentos de contención cuando hay sandbox disponible, o ejecutando directamente con metadatos de degradación.
   - Captura y traduce errores de escape de sandbox (como `Read-only file system`, `Operation not permitted`) devolviéndolos como texto sin romper el turno.
