# Proposal

## Why

Una conversación guardada solo se puede reanudar desde el final. Si una decisión
tomada tres turnos atrás era mejor, hay que repetir todo el trabajo. Y con varias
sesiones por proyecto, no hay forma de encontrar en cuál se habló de un tema.

## What Changes

- Una sesión se puede ramificar desde un turno anterior, sin tocar la original.
- La rama nueva registra de qué sesión y de qué turno salió.
- Se puede buscar texto en el historial de las sesiones del proyecto.
- La TUI expone `/rama <n>` y `/sesiones buscar <texto>`.
- La línea de comandos expone `--rama-de <id> --desde <n>`.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `sesiones`: ramificación y búsqueda.
- `interface`: comandos de rama y búsqueda.

## Impact

- `src/sesiones/almacen.ts`: `ramificar` y `buscar`.
- `src/interface/runner.ts`: `ramificar` y `buscarSesiones`.
- `src/interface/{commands,app,app-interactiva}.tsx`: comandos y panel.
- `src/{args,app,main}.ts`: `--rama-de` y `--desde`.
- `tests/sesiones/` y `tests/interface/`.
