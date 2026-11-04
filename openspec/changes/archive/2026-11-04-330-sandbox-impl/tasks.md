# Tasks: 330-sandbox-impl

## 1. Módulo Sandbox
- [x] 1.1 Crear `src/sandbox/types.ts` con interfaces de configuración y estado de aislamiento.
- [x] 1.2 Crear `src/sandbox/plataforma.ts` con detección de mecanismos y degradación transparente.
- [x] 1.3 Crear `src/sandbox/temporales.ts` para creación y limpieza de temporales efímeros por ejecución.
- [x] 1.4 Crear `src/sandbox/ejecutor.ts` con contención de escrituras y retorno de violaciones como texto.
- [x] 1.5 Exportar en `src/sandbox/index.ts`.

## 2. Pruebas y Validación
- [x] 2.1 Implementar `tests/sandbox/sandbox.test.ts` cubriendo los 19 escenarios de `openspec/specs/sandbox/spec.md`.
- [x] 2.2 Validar con `npm run check` y archivar change.
