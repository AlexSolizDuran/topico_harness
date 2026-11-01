# Proposal

## Why

El Nivel 7 sigue abierto en su integración externa. Hoy el agente solo puede usar
las herramientas del harness. Conectar una fuente externa obliga a escribir código
nuevo; no hay forma de sumar herramientas sin tocar el proyecto.

MCP resuelve eso: el harness conecta servidores y el modelo usa sus herramientas
sin que el código del harness conozca cada integración.

## What Changes

- Nueva capacidad `mcp`: servidores externos declarados en la configuración.
- Conexión bajo demanda: las herramientas de un servidor aparecen solo cuando el
  servidor está conectado.
- Nombres de herramienta con el servidor como prefijo, para evitar colisiones.
- Validación de argumentos contra el esquema que declara el servidor y resultado
  como texto, con truncado y sanitización de credenciales.
- Un servidor que no arranca, se cae o no responde no detiene la sesión.
- `permissions`: nueva acción para usar una herramienta externa, con el servidor
  y la herramienta como recurso. Sin regla aplicable se consulta; una regla
  `denegar` impide; una herramienta puede elevarse a aprobación obligatoria.
- Un agente solo ve los servidores MCP que declara; sin declaración no recibe
  herramientas externas.
- Fuera de alcance: implementar el comportamiento, transporte remoto, OAuth,
  empaquetar servidores, carga anticipada de todas las herramientas y MCP como
  fuente de prompts.

## Capabilities

### New Capabilities

- `mcp`: configuración de servidores, conexión bajo demanda, exposición de
  herramientas, ejecución, fallos y visibilidad por agente.

### Modified Capabilities

- `permissions`: nueva acción para usar una herramienta externa.

## Impact

- Solo specs: `openspec/specs/mcp/spec.md` y
  `openspec/specs/permissions/spec.md`.
- Sin cambios en `src/`, `tests/` ni `docs/comportamiento.md`.
- La implementación futura reusa el registro de herramientas, el portero y el
  adaptador de configuración; no requiere una dependencia nueva en el contrato.
- Al archivar, actualizar los conteos de `AGENTS.md` y `openspec/config.yaml`;
  esa higiene va en `360-higiene-alcance`.
- Depende de la estabilidad de herramientas de `315-contexto-restante` para no
  romper la caché del prefijo.
