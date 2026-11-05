# Proposal

## Why

Las capacidades `memory`, `sandbox`, `lsp` y `mcp` tienen módulo y tests propios,
pero no están cableadas al arranque: `src/app.ts` no las instancia, la
configuración no las lee y el catálogo de herramientas no las expone. Los changes
archivados `320-memory-impl`, `330-sandbox-impl`, `340-lsp-impl` y `350-mcp-impl`
marcaron tareas de integración como completadas, pero esas tareas no están en el
código. El resultado es que el harness reporta 16 capacidades y solo ejecuta 12.

Además, algunos módulos son más superficiales de lo que sus tests sugieren: el
aislamiento asume que el mecanismo existe sin comprobarlo, el cliente LSP no
completa el ciclo de vida que necesitan los diagnósticos, la validación de
argumentos MCP es un `passthrough` y las variables de entorno MCP se mezclan como
valores literales. Este change cierra la brecha de integración y corrige esos
puntos sin cambiar el contrato.

## What Changes

- **Configuración**: agregar las claves `sandbox`, `memoria`, `lsp` y `mcp` a
  `.harness/config.json`, con validación y merge global + proyecto.
- **Agentes**: agregar `mcp` a la definición de agente para declarar qué
  servidores ve cada uno. Sin declaración, no recibe herramientas externas.
- **Sandbox**: ejecutar `shell` a través del aislamiento, informar en el resultado
  si corrió aislado y mostrar el aviso visible cuando no. Verificar que el
  mecanismo exista antes de presentarlo como activo.
- **LSP**: registrar la herramienta `lsp`, consultar diagnósticos después de
  editar y cerrar los servidores con la sesión. Completar `didOpen`,
  `publishDiagnostics` y el apagado ordenado del cliente.
- **MCP**: registrar las herramientas de los servidores declarados por el agente,
  validar sus argumentos contra el esquema real, resolver variables de entorno por
  nombre y cerrar los procesos al terminar.
- **Memoria**: cargar e inyectar el índice al arrancar, contarlo en el
  presupuesto, permitir el detalle bajo demanda con `read` y extraer hechos al
  cerrar sin impedir el cierre si falla.
- **Documentación**: actualizar `AGENTS.md`, `openspec/config.yaml`,
  `docs/comportamiento.md`, `PREGUNTAS.md` y `README.md` para reflejar las 16
  capacidades implementadas y el conteo real de tests.

No hay cambios de comportamiento especificado: los requisitos ya existen en
`openspec/specs/`. Este change es de implementación y lleva `skip_specs: true`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna. El change materializa requisitos ya acordados en `memory`, `sandbox`,
`lsp` y `mcp`, y en las capacidades que se cruzan con ellas (`tools`,
`interface`, `agents`, `permissions`). No introduce ni modifica requisitos.

## Impact

- Código: `src/app.ts`, `src/provider/config.ts`, `src/agents/`,
  `src/tools/shell.ts`, `src/tools/catalog.ts`, `src/interface/runner.ts`,
  `src/sandbox/`, `src/lsp/`, `src/mcp/`, `src/memory/`.
- Pruebas: `tests/integracion/` (nuevo) y ajustes en `tests/sandbox/`,
  `tests/lsp/` y `tests/mcp/` para las correcciones de los módulos.
- Configuración de ejemplo: `.harness/config.json` y `.harness/agents.json`.
- Documentación: los archivos listados arriba.
- Sin dependencias nuevas y sin cambios en el contrato de `openspec/specs/`.
- Un proyecto que no declare estas claves se comporta exactamente como hoy.
