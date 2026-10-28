# Tasks

## 1. Configuración

- [ ] 1.1 Sumar `hooks` a `ConfiguracionHarness` y a `validarConfig`, con lista por evento, `comando` obligatorio y `match` opcional; verificar los escenarios de configuración válida y de entrada sin comando.
- [ ] 1.2 Rechazar eventos desconocidos y `match` inválidos al arrancar, nombrando evento y posición; verificar el escenario de evento desconocido.
- [ ] 1.3 Dejar el comportamiento intacto cuando no hay clave `hooks`; verificar el escenario sin hooks.

## 2. Ejecución

- [ ] 2.1 Crear `src/hooks/ejecutar.ts` con el JSON de entrada por evento, la espera y el timeout configurable de 30 segundos; verificar los escenarios de `preTool`, `postTool`, `sessionStart` y hook colgado.
- [ ] 2.2 Interpretar los códigos `0`, `1` y `2` por evento, incluida la excepción de `sessionStart` y el aviso de `turnEnd`/`sessionEnd`; verificar los siete escenarios de códigos.
- [ ] 2.3 Aislar los fallos: comando inexistente como aviso, salida truncada a 8 KiB con marcador y sanitización de credenciales; verificar los tres escenarios de aislamiento.

## 3. Enganche en el ciclo

- [ ] 3.1 Disparar `preTool` y `postTool` en `dispatch`, después del portero y con el resultado; verificar que una herramienta denegada no dispara `preTool`.
- [ ] 3.2 Disparar `turnEnd` al cerrar el turno, incluida la cancelación; verificar el escenario de turno cancelado.
- [ ] 3.3 Disparar `sessionStart` y `sessionEnd` desde `construirHarness` y el cierre de la sesión; verificar el escenario de cada evento una vez.

## 4. Permisos y subagentes

- [ ] 4.1 Sumar `hook` a `AccionPermisoCanon` y una regla base `consultar` al final de `REGLAS_BASE`; verificar los escenarios de aprobación, `permitir` y `denegar`.
- [ ] 4.2 Propagar `preTool` y `postTool` a los subagentes sin `sessionStart` ni `sessionEnd`; verificar el escenario del subagente.

## 5. Interfaz y cierre

- [ ] 5.1 Mostrar las notas y los bloqueos de hooks en la TUI y en el renderizador de línea a línea; verificar que una nota de `exit 1` aparece junto al resultado.
- [ ] 5.2 Documentar la clave `hooks` en `.harness/config.example.json`; verificar que el ejemplo es JSON válido y no lleva credenciales.
- [ ] 5.3 Actualizar `AGENTS.md`, `openspec/config.yaml`, `docs/comportamiento.md`, `PREGUNTAS.md` y `alcance/nivel-7-seguridad-integracion.md`; verificar que las cifras coinciden con los specs.
- [ ] 5.4 Ejecutar `npm run check` y `openspec validate --all`; verificar que ambos terminan en verde.
- [ ] 5.5 Archivar el change con `openspec archive`; verificar que `openspec list` no muestra changes activos.
