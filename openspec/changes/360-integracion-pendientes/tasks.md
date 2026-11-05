# Tasks

## 1. Configuración y visibilidad por agente

- [x] 1.1 Agregar `sandbox`, `memoria`, `lsp` y `mcp` a `ConfiguracionHarness` con sus validadores en `src/provider/config.ts`, y verificar con tests de configuración válida e inválida que un arranque sin esas claves siga funcionando.
- [x] 1.2 Implementar el merge global + proyecto para `mcp` (por `id`), `lsp` (por `lenguaje`), `sandbox` y `memoria`, y verificar con un test que el proyecto pisa la entrada global y conserva las demás.
- [x] 1.3 Agregar `mcp?: string[]` a `DefinicionAgente`, validarlo contra los servidores configurados y verificar que un agente sin declaración no recibe herramientas externas.
- [x] 1.4 Extender el filtro de herramientas de `SesionInteractiva` y del ejecutor de subagentes con un callback de herramientas extra, y verificar que un agente con `mcp` declarado recibe la unión sin romper la intersección de solo lectura de los subagentes.
- [x] 1.5 Actualizar `.harness/config.json` y `.harness/agents.json` de ejemplo, y verificar que `npm run check` sigue en verde.

## 2. Sandbox

- [x] 2.1 Extender `OpcionesShell.ejecutor` para devolver `aislamiento` y `avisoAislamiento`, agregar la línea de estado al resultado de `shell` y verificar con tests que una ejecución aislada y una no aislada se informan distinto.
- [x] 2.2 Hacer que `determinarMecanismoAislamiento` compruebe la disponibilidad real de `bwrap`/`sandbox-exec` y degradar con motivo cuando no existan o el proceso falle al arrancar; verificar con tests que nunca se reporta `aislado: true` sin mecanismo.
- [x] 2.3 Cablear `EjecutorSandbox` en `crearCatalogoPorDefecto` y `construirHarness`, conectar el aviso a `SesionInteractiva` y cerrar el ejecutor en `HarnessConstruido.cerrar()`; verificar con un test de integración que el aviso aparece y el temporal se limpia.
- [x] 2.4 Actualizar la fila de `sandbox` en `AGENTS.md` y la sección correspondiente de `docs/comportamiento.md`; verificar que la documentación describe el aviso y la degradación tal como quedaron.

## 3. LSP

- [x] 3.1 Instanciar `GestorLsp` en `construirHarness`, registrar `crearHerramientaLsp` en el catálogo y cerrarlo en `HarnessConstruido.cerrar()`; verificar que sin servidores configurados la herramienta responde con error de texto y que con servidores el cierre no deja procesos.
- [x] 3.2 Decorar en el catálogo las herramientas `edit`, `write` y `apply_patch` para consultar diagnósticos del archivo modificado y agregarlos truncados; verificar con tests que una edición con errores los incluye, una sin errores no agrega lista y un fallo del LSP no revierte la edición.
- [x] 3.3 Completar el cliente LSP con `textDocument/didOpen`, el procesamiento de `textDocument/publishDiagnostics` y `shutdown`/`exit` en el cierre; verificar contra un servidor real (`typescript-language-server`) o un servidor falso que emita notificaciones, y dejar el fallo como texto si no está instalado.
- [x] 3.4 Agregar tests de integración de la herramienta `lsp` (definición, referencias, símbolos, hover y diagnósticos) y verificar que un subagente que la declara la recibe y uno que no, no.
- [x] 3.5 Actualizar la fila de `lsp` en `AGENTS.md` y la sección correspondiente de `docs/comportamiento.md`; verificar que la documentación refleja el registro de la herramienta y los diagnósticos post-edición.

## 4. MCP

- [x] 4.1 Cambiar `env` de `ConfiguracionServidorMcp` a `string[]` de nombres, resolver los valores desde `process.env` al arrancar el servidor y rechazar cualquier forma literal; verificar con tests que un nombre ausente se omite y que el config del proyecto no acepta secretos.
- [x] 4.2 Reemplazar `jsonSchemaAZod` por validación real de un subconjunto de JSON Schema (`type`, `properties`, `required`, `enum`, `items`, `additionalProperties`) y verificar que argumentos inválidos vuelven como texto sin ejecutar la herramienta.
- [x] 4.3 Convertir cada `HerramientaMcp` en una `EntradaHerramienta` con nombre `<servidor>_<herramienta>`, `accionPermiso: 'mcp'`, recurso `<servidor>/<herramienta>` y elevación por riesgo; verificar con tests de permiso `permitir`, `denegar` y aprobación obligatoria.
- [x] 4.4 Implementar la conexión al inicio del primer turno solo para los servidores declarados por el agente activo, registrar sus herramientas al final del orden y permitir la reconexión en turnos posteriores; verificar con un servidor MCP falso que los servidores no declarados no se conectan y que un servidor caído se reintenta.
- [x] 4.5 Cablear `GestorMcp` en `construirHarness`, filtrar por agente y cerrar los procesos en `HarnessConstruido.cerrar()`; verificar con un test de integración que no quedan procesos vivos.
- [x] 4.6 Actualizar la fila de `mcp` en `AGENTS.md` y la sección correspondiente de `docs/comportamiento.md`; verificar que la documentación describe la forma de `env` por nombre y la visibilidad por agente.

## 5. Memoria

- [x] 5.1 Cargar el índice de `AlmacenMemoria` al construir la sesión, formatear el bloque con `formatearBloqueMemoria` y concatenarlo al prompt de sistema con su marcador; verificar con un test que un proyecto con memoria la inyecta, uno sin memoria arranca igual y no se mezcla con otro proyecto.
- [x] 5.2 Agregar `tokensSistemaMemoria` a `OpcionesSesion` y sumarlo en `calcularMetricas` y `medirParaEnviar`; verificar con un test que el bloque cuenta en el presupuesto y que un exceso pasa por el pipeline sin truncar la memoria en silencio.
- [x] 5.3 Incluir la ruta del detalle en el índice para que el modelo lo lea con `read`, y verificar con un test que el detalle no se carga al arrancar y que `read` puede obtenerlo.
- [x] 5.4 Exponer el historial en solo lectura desde `SesionInteractiva` y orquestar en `HarnessConstruido.cerrar()` la extracción, `resolverContradicciones` y la escritura atómica; verificar con tests que se guarda un hecho no deducible, se descarta lo obvio y un fallo de extracción no impide cerrar.
- [x] 5.5 Actualizar la fila de `memory` en `AGENTS.md` y la sección correspondiente de `docs/comportamiento.md`; verificar que la documentación distingue instrucciones, memoria e historial.

## 6. Integración y cierre

- [x] 6.1 Ejecutar `npm run check` completo y `npm run build`, y corregir cualquier regresión de lint, tipos o tests existentes.
- [x] 6.2 Hacer un smoke test de punta a punta en un proyecto temporal con las cuatro claves configuradas: verificar que `shell` informa aislamiento, que `lsp` responde, que un servidor MCP de prueba aporta su herramienta y que la memoria se inyecta y se guarda al cerrar.
- [x] 6.3 Actualizar el estado global de `AGENTS.md`, `openspec/config.yaml`, `PREGUNTAS.md` y `README.md` a 16 capacidades implementadas y al conteo real de tests; verificar con `openspec validate 360-integracion-pendientes --strict` y `openspec status --change 360-integracion-pendientes`.
