# Tareas 010-nucleo

- [x] 1. Ampliar `src/types.ts` con tipos de eventos de turno (`EventoTurno`) y estado final (`EstadoTurno`).
- [x] 2. Implementar `src/core/registry.ts` con el registro de herramientas como estructura de datos.
- [x] 3. Implementar `src/core/history.ts` para validación y preservación atómica de mensajes.
- [x] 4. Implementar `src/core/dispatch.ts` para validación de argumentos y captura de errores como texto.
- [x] 5. Implementar `src/core/turn.ts` con el bucle iterativo, límite de pasos y soporte para cancelación con `AbortSignal`.
- [x] 6. Exportar API pública en `src/core/index.ts`.
- [x] 7. Implementar `tests/core/core.test.ts` con los 23 tests mapeados 1 a 1 a los escenarios normativos (incluyendo prueba estática de no-import de `interface/`).
- [x] 8. Ejecutar y verificar `npm run check` (Biome + Typecheck + Vitest).
