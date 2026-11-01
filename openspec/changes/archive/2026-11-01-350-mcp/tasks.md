# Tasks

## 1. Specs

- [x] 1.1 Redactar en `mcp` la configuración de servidores, la conexión bajo demanda y el prefijo de nombres.
- [x] 1.2 Redactar la ejecución con esquema, resultado como texto, truncado y sanitización.
- [x] 1.3 Redactar el aislamiento de fallos, el timeout, el reintento y el cierre sin procesos huérfanos.
- [x] 1.4 Redactar el permiso por herramienta externa y la visibilidad por agente.
- [x] 1.5 Agregar a `permissions` la acción de usar una herramienta externa, conservando las acciones de lenguaje y de repetición.

## 2. Verificación

- [x] 2.1 Revisar que cada escenario nuevo tenga `WHEN` y `THEN` y que no contradiga `tools`, `agents` ni `permissions`.
- [x] 2.2 Ejecutar `openspec validate --all` y corregir lo que marque.
- [x] 2.3 Sincronizar los deltas a `openspec/specs/` y verificar los conteos.
- [x] 2.4 Archivar el change con `openspec archive`.

## 3. Implementación

- [ ] 3.1 Derivar el change de implementación con `skip_specs: true` y sus tests, sin tocar este change.
