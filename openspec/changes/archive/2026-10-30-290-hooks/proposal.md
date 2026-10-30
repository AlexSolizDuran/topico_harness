# Proposal

## Why

Todo lo que se le pide al modelo por prompt es una sugerencia: a los doce pasos se
olvidó. Un hook es una intercepción del harness, no una instrucción al modelo, y
por eso no se puede saltear. Es además la precondición de la memoria aprendida:
sin `sessionEnd` no hay dónde enganchar la auto-extracción.

## What Changes

- Nueva capacidad `hooks`: cinco eventos (`sessionStart`, `preTool`, `postTool`,
  `turnEnd`, `sessionEnd`) declarados en la clave `hooks` del config.
- Cada entrada declara un `comando` y, opcionalmente, un `match` sobre el nombre de
  la herramienta.
- El hook recibe por entrada estándar un JSON con el evento, el proyecto y, cuando
  corresponde, la herramienta, sus argumentos y su resultado.
- El código de salida decide: `0` sigue, `1` agrega una nota visible, `2` bloquea.
  Cualquier otro código se trata como `1`.
- Timeout configurable de 30 segundos y salida limitada a 8 KiB con marcador.
- Un hook que falla devuelve un aviso como texto; nunca detiene la sesión.
- Nueva acción de permiso `hook`, con el evento como recurso. Por defecto pide
  aprobación, porque el config se versiona y un repo ajeno podría traer comandos.
  Una aprobación "siempre" la recuerda por proyecto.
- Los hooks de herramienta corren después del portero: una herramienta denegada no
  dispara `preTool`.
- Los subagentes disparan `preTool` y `postTool`; no disparan `sessionStart` ni
  `sessionEnd`.
- Fuera de alcance: auto-extracción de memoria, snapshots para deshacer, hooks
  globales, hooks por agente.

## Capabilities

### New Capabilities

- `hooks`: declaración, ejecución, códigos de salida, aislamiento y permisos.

### Modified Capabilities

Ninguna.

## Impact

- Código: `src/hooks/` (nuevo), `src/provider/config.ts`, `src/core/turn.ts`,
  `src/core/dispatch.ts`, `src/types.ts`, `src/permissions/`, `src/app.ts`,
  `src/subagents/`, `src/interface/`.
- Pruebas: `tests/hooks/` (nuevo).
- Documentación: `AGENTS.md`, `openspec/config.yaml`, `docs/comportamiento.md`,
  `PREGUNTAS.md`, `alcance/nivel-7-seguridad-integracion.md`.
- Sin dependencias nuevas: la ejecución reusa el mecanismo por plataforma que ya
  usa la herramienta `shell`.
- Dependencia de secuencia: asume el config versionado de
  `265-config-compartida`, que es lo que hace que los hooks se compartan y que el
  default de aprobación sea `consultar`.
