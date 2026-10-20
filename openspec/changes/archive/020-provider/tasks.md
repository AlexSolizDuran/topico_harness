# Tareas 020-provider

- [x] 1. Definir tipos compartidos en `src/types.ts` (`Mensaje`, `EventoProveedor`, `ConteoTokens`).
- [x] 2. Definir contratos e interfaces del proveedor en `src/provider/types.ts`.
- [x] 3. Implementar extracción y sanitización de credenciales en `src/provider/credentials.ts`.
- [x] 4. Implementar reintentos con backoff exponencial e inyección de temporizador en `src/provider/retry.ts`.
- [x] 5. Implementar adaptador de proveedor agnóstico y mock para pruebas en `src/provider/mock.ts`.
- [x] 6. Configurar exports públicos en `src/provider/index.ts`.
- [x] 7. Implementar los 17 tests en `tests/provider/provider.test.ts` mapeados con los 17 escenarios normativos.
- [x] 8. Ejecutar y verificar `npm run check` (Biome + Typecheck + Vitest).
