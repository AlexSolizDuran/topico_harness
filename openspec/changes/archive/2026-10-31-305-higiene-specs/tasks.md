# Tasks

## 1. Specs

- [x] 1.1 Modificar el catálogo de acciones de `permissions` para incluir cargar skill y ejecutar hook, con sus recursos y un escenario propio.
- [x] 1.2 Modificar `agents` para declarar el campo `permisos` en la definición y rechazar una regla con forma inválida al arrancar.
- [x] 1.3 Agregar el requisito del panel `/skills` en `interface`, con los escenarios de catálogo, proyecto sin skills, skills omitidas y panel que no inicia un turno.

## 2. Verificación

- [x] 2.1 Revisar que cada requisito modificado conserve sus escenarios anteriores y que cada escenario nuevo tenga `WHEN` y `THEN`.
- [x] 2.2 Ejecutar `openspec validate --all` cuando el CLI de OpenSpec esté disponible.
- [ ] 2.3 Derivar los tests de los escenarios nuevos en el change de implementación; deuda aceptada, este change no toca `tests/`.
- [x] 2.4 Actualizar los conteos de `AGENTS.md` y `openspec/config.yaml` al archivar.
