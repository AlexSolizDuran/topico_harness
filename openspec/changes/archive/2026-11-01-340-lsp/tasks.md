# Tasks

## 1. Specs

- [x] 1.1 Redactar en `lsp` la configuración de servidores, las operaciones por símbolos y sus esquemas.
- [x] 1.2 Redactar los diagnósticos posteriores a una edición, el límite de archivos y el truncado del resultado.
- [x] 1.3 Redactar la degradación sin servidor, el ciclo de vida bajo demanda y el cierre sin procesos huérfanos.
- [x] 1.4 Redactar la condición de solo lectura y el uso en subagentes.
- [x] 1.5 Agregar a `permissions` la acción de leer símbolos con la operación y el archivo como recurso.

## 2. Verificación

- [x] 2.1 Revisar que cada escenario nuevo tenga `WHEN` y `THEN` y que no contradiga `tools`, `subagents` ni `permissions`.
- [x] 2.2 Ejecutar `openspec validate --all` y corregir lo que marque.
- [x] 2.3 Sincronizar los deltas a `openspec/specs/` y verificar los conteos.
- [x] 2.4 Archivar el change con `openspec archive`.

## 3. Implementación

- [ ] 3.1 Derivar el change de implementación con `skip_specs: true` y sus tests, sin tocar este change.
