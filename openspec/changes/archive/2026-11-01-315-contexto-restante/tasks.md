# Tasks

## 1. Specs

- [x] 1.1 Agregar a `context` el requisito de recordatorios de sistema, con los tres disparadores, el objetivo original fuera del historial compactable y el límite por turno.
- [x] 1.2 Agregar a `provider` el requisito de prefijo estable: prompt de sistema fijo, orden de herramientas estable e historial solo por agregado.
- [x] 1.3 Agregar a `tools` el requisito de cola de salida para la herramienta de ejecución, por comando y con marca de lo omitido.
- [x] 1.4 Agregar a `interface` el requisito de conservar y mostrar la salida completa de ejecución.

## 2. Verificación

- [x] 2.1 Revisar que cada escenario nuevo tenga `WHEN` y `THEN` y que ningún requisito existente se contradiga.
- [x] 2.2 Ejecutar `openspec validate --all` y corregir lo que marque.
- [x] 2.3 Sincronizar los deltas a `openspec/specs/` y verificar los conteos.
- [x] 2.4 Archivar el change con `openspec archive`.

## 3. Implementación

- [ ] 3.1 Derivar el change de implementación con `skip_specs: true` y sus tests, sin tocar este change.
