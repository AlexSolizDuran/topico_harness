# Tasks

## 1. Specs

- [x] 1.1 Redactar en `sandbox` el requisito de aislamiento del sistema operativo, con escrituras limitadas al proyecto y a un temporal.
- [x] 1.2 Redactar la aplicación por herramienta, el error de escape como texto y la limpieza del temporal.
- [x] 1.3 Redactar la configuración habilitado/deshabilitado y la degradación visible en plataformas sin aislamiento.
- [x] 1.4 Agregar a `tools` el requisito de informar el aislamiento en el resultado de ejecución.
- [x] 1.5 Agregar a `interface` el requisito de avisar cuando la ejecución no está aislada.

## 2. Verificación

- [x] 2.1 Revisar que cada escenario nuevo tenga `WHEN` y `THEN` y que no contradiga el catálogo, la lista negra ni los permisos.
- [x] 2.2 Ejecutar `openspec validate --all` y corregir lo que marque.
- [x] 2.3 Sincronizar los deltas a `openspec/specs/` y verificar los conteos.
- [x] 2.4 Archivar el change con `openspec archive`.

## 3. Implementación

- [ ] 3.1 Derivar el change de implementación con `skip_specs: true` y sus tests, sin tocar este change.
