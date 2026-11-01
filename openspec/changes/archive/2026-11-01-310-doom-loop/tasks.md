# Tasks

## 1. Specs

- [x] 1.1 Reemplazar en `core` el requisito de bloqueo por repetición por el de aprobación obligatoria, conservando el conteo, la comparación canónica y los reinicios.
- [x] 1.2 Agregar la acción de detectar repetición al catálogo de `permissions`, con el nombre de la herramienta como recurso.
- [x] 1.3 Extender la aprobación obligatoria de `permissions` para incluir la repetición, la combinación de motivos y la ausencia de regla guardada.

## 2. Verificación

- [x] 2.1 Revisar que cada requisito modificado conserve sus escenarios anteriores y que cada escenario nuevo tenga `WHEN` y `THEN`.
- [x] 2.2 Ejecutar `openspec validate --all` cuando el CLI de OpenSpec esté disponible.
- [ ] 2.3 Derivar los tests de los escenarios nuevos en el change de implementación; deuda aceptada, este change no toca `tests/`.
- [ ] 2.4 Actualizar los conteos de `AGENTS.md` y `openspec/config.yaml` al archivar.
