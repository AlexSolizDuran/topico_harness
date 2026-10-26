# Proposal

## Why

`edit` reemplaza una ocurrencia exacta de texto y falla cuando el texto aparece dos
veces. Eso obliga al modelo a inventar contexto único, y cuando el archivo cambió
entre la lectura y la edición el error no dice qué falló. Un parche por bloques
declara la intención —agregar, actualizar o borrar— y valida todo antes de tocar el
primer archivo.

## What Changes

- Nueva herramienta `apply_patch` que recibe un parche compuesto por bloques.
- Cada bloque declara agregar, actualizar o borrar un archivo del proyecto.
- La actualización localiza un bloque de líneas y exige una coincidencia única,
  igual que `edit`, pero sin obligar a construir una cadena larga en un argumento.
- El parche se valida completo antes de escribir: un bloque inválido deja todos los
  archivos intactos.
- La herramienta declara la acción de permiso de edición, el conjunto de rutas
  afectadas y que no admite ejecución en paralelo.
- `build` la recibe en el catálogo por defecto y en `.harness/agents.json`.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `tools`: se agregan los requisitos de parche por bloques, validación previa,
  coincidencia única y declaración de permiso/paralelo.

## Impact

- `src/tools/patch.ts`: nuevo ejecutor y parser del parche.
- `src/tools/catalog.ts` y `src/tools/index.ts`: alta en el catálogo y export.
- `src/agents/defaults.ts` y `.harness/agents.json`: `build` incluye la herramienta.
- `tests/tools/`: un test por escenario del delta.
- `AGENTS.md`: tabla de capacidades y conteo de requisitos/escenarios/tests.
