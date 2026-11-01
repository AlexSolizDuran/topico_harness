# Tasks

## 1. Specs

- [x] 1.1 Redactar en `memory` el requisito de carga al arrancar: índice siempre, detalle bajo demanda y aislamiento por proyecto.
- [x] 1.2 Redactar la separación entre instrucciones estables y memoria aprendida, y la inyección como bloque de sistema contabilizado.
- [x] 1.3 Redactar la auto-extracción al cerrar: modelo barato, filtro de hechos no deducibles, escritura atómica y fallo que no impide el cierre.
- [x] 1.4 Redactar la curación, el ámbito proyecto/usuario y el tope que falla en vez de truncar.
- [x] 1.5 Vincular la escritura directa del modelo a la acción de permiso `edit`, sin inventar una acción nueva.

## 2. Verificación

- [x] 2.1 Revisar que cada escenario nuevo tenga `WHEN` y `THEN` y que no contradiga `instructions`, `context` ni `hooks`.
- [x] 2.2 Ejecutar `openspec validate --all` y corregir lo que marque.
- [x] 2.3 Sincronizar el delta a `openspec/specs/memory/spec.md` y verificar los conteos.
- [x] 2.4 Archivar el change con `openspec archive`.

## 3. Implementación

- [ ] 3.1 Derivar el change de implementación con `skip_specs: true` y sus tests, sin tocar este change.
