# Tasks

## 1. Gestor

- [x] 1.1 Crear `src/subagents/background.ts` con el estado de cada tarea.
- [x] 1.2 Implementar el tope de concurrencia y la liberación de un lugar al terminar.
- [x] 1.3 Convertir excepciones en resultado fallido y cancelaciones en canceladas.
- [x] 1.4 Implementar `consumirResultados` sin repetir tareas inyectadas.
- [x] 1.5 Notificar cambios de conteo a un observador.

## 2. Herramientas

- [x] 2.1 Extraer la validación y el armado del pedido de `task`.
- [x] 2.2 Sumar `background` al esquema y ejecutar el subagente a través del gestor.
- [x] 2.3 Crear `task_status` y `task_cancel` con sus esquemas y permisos.
- [x] 2.4 Registrar las tres herramientas en `construirHarness` cuando hay catálogo propio.

## 3. Sesión

- [x] 3.1 Pasar el gestor a `SesionInteractiva`.
- [x] 3.2 Extraer la iteración de turno para poder repetirla.
- [x] 3.3 Esperar, inyectar resultados y continuar al cerrar el turno.
- [x] 3.4 Acotar las continuaciones y dejar un aviso al llegar al límite.
- [x] 3.5 Cancelar las tareas al cancelar el turno del padre.
- [x] 3.6 Actualizar `tareasBackground` en el estado visual.

## 4. Interfaz

- [x] 4.1 Mostrar el conteo en `BarraEstado`.

## 5. Pruebas

- [x] 5.1 Un test por escenario del delta de `subagents`.
- [x] 5.2 Un test por escenario del delta de `interface`.
- [x] 5.3 Correr `npm run check` en verde.

## 6. Cierre

- [x] 6.1 Actualizar `AGENTS.md` y los conteos.
- [x] 6.2 `openspec validate 220-tareas-background`.
- [x] 6.3 Archivar el change.
