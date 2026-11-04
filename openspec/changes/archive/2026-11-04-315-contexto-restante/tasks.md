# Tasks: 315-contexto-restante

## 1. Context: Recordatorios y Preservación de Objetivo
- [x] 1.1 Crear `src/context/reminders.ts` con lógica de generación de recordatorios (post-edición, pasos sin escribir, post-compactación).
- [x] 1.2 Integrar recordatorios y conservación de objetivo original en el turno (`src/core/turn.ts` o runner).
- [x] 1.3 Implementar pruebas para los 7 escenarios de `Requirement: El sistema inyecta recordatorios de sistema en eventos del turno` en `tests/context/context.test.ts`.

## 2. Provider: Prefijo Estable
- [x] 2.1 Garantizar ordenamiento estable de herramientas enviadas al provider.
- [x] 2.2 Garantizar estabilidad del prompt de sistema e historial incremental dentro del turno.
- [x] 2.3 Implementar pruebas para los 4 escenarios de `Requirement: El prefijo de la petición se mantiene estable` en `tests/provider/provider.test.ts`.

## 3. Tools: Cola de Salida de Shell
- [x] 3.1 Implementar formateo tipo cola en `src/tools/shell.ts` / `src/tools/truncate.ts` con marcador de caracteres omitidos y salida completa disponible.
- [x] 3.2 Implementar pruebas para los 5 escenarios de `Requirement: La salida de la herramienta de ejecución se entrega como cola` en `tests/tools/tools.test.ts`.

## 4. Interface: Conservación de Salida Completa
- [x] 4.1 Almacenar y exponer la salida completa en el estado visual e historial de la interfaz.
- [x] 4.2 Distinguir la cola del modelo de la salida completa en los componentes visuales.
- [x] 4.3 Implementar pruebas para los 4 escenarios de `Requirement: La interfaz conserva la salida completa de la herramienta de ejecución` en `tests/interface/interface.test.ts`.

## 5. Verificación
- [x] 5.1 Ejecutar `npm run check` (biome, tsc, vitest).
- [x] 5.2 Validar OpenSpec con `npx @fission-ai/openspec validate --all`.
