# Tasks: 320-memory-impl

## 1. Módulo Memory
- [x] 1.1 Crear `src/memory/types.ts` con interfaces (`EntradaMemoria`, `OpcionesMemoria`, `ResultadoExtracion`).
- [x] 1.2 Crear `src/memory/almacen.ts` con carga de índice, carga diferida de detalles, validación de topes y escritura atómica.
- [x] 1.3 Crear `src/memory/curacion.ts` para resolución de contradicciones y marcado de entradas obsoletas.
- [x] 1.4 Crear `src/memory/inyector.ts` para formateo del bloque de sistema, conteo de tokens y precedencia proyecto/usuario.
- [x] 1.5 Crear `src/memory/extractor.ts` para extracción de hechos al cierre con manejo de fallos y descarte de obviedades.
- [x] 1.6 Exportar en `src/memory/index.ts`.

## 2. Integración
- [x] 2.1 Integrar carga e inyección de memoria en `src/interface/runner.ts`.
- [x] 2.2 Integrar extracción al cerrar sesión.

## 3. Pruebas y Validación
- [x] 3.1 Implementar `tests/memory/memory.test.ts` cubriendo los 29 escenarios de `openspec/specs/memory/spec.md`.
- [x] 3.2 Validar con `npm run check` y `npx @fission-ai/openspec validate 320-memory-impl`.
