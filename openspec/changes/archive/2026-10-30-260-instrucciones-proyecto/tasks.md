# Tasks

## 1. Carga de instrucciones

- [x] 1.1 Crear `src/instructions/` con `cargarInstruccionesProyecto`, que lee `AGENTS.md`, ignora archivo ausente o vacío y devuelve contenido más tamaño; verificar con `tests/instructions/` que cubra los escenarios de carga.
- [x] 1.2 Agregar el tope configurable (32 KiB por defecto) y `ErrorInstruccionesExcedidas` con mensaje que nombra archivo, tamaño y tope; verificar que el escenario de tope falla y el de "justo en el tope" arranca.
- [x] 1.3 Exportar la capacidad desde `src/instructions/index.ts` y documentar el contrato en `docs/comportamiento.md`; verificar que `npm run typecheck` pasa.

## 2. Cableado en la sesión

- [x] 2.1 Componer el prompt en `construirHarness` como `base → instrucciones → agente`, sin leer dentro del runner; verificar con un test que el prompt de sistema contiene el contenido y que el del agente queda al final.
- [x] 2.2 Pasar el tamaño de las instrucciones a `SesionInteractiva` y conservarlo al reanudar y al cambiar de agente; verificar los dos escenarios con tests de `tests/instructions/`.

## 3. Presupuesto

- [x] 3.1 Agregar `tokensSistema` a `MetricasContexto` y a `medirContexto`, sumándolo solo cuando el conteo es estimado; verificar con tests de `tests/context/` que el uso incluye el prompt y no lo duplica cuando el provider reporta.
- [x] 3.2 Propagar `tokensSistema` en `medirParaEnviar` y en la validación previa al envío; verificar que un prompt grande reduce el disponible y que el envío se bloquea si se supera el límite.
- [x] 3.3 Actualizar los fixtures de `MetricasContexto` en los tests existentes; verificar que `npm run check` pasa.

## 4. Cierre

- [x] 4.1 Actualizar `AGENTS.md` (capacidades, conteos, fila de `src/instructions/`), `openspec/config.yaml`, `PREGUNTAS.md` y `alcance/nivel-8-memoria.md`; verificar que las cifras coinciden con los specs.
- [x] 4.2 Ejecutar `npm run check` y `openspec validate --all`; verificar que ambos terminan en verde.
- [x] 4.3 Archivar el change con `openspec archive`; verificar que `openspec list` no muestra changes activos.
