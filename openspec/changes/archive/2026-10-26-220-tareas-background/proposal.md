# Proposal

## Why

`task` bloquea el turno hasta que el subagente termina. Para una investigación
larga, el agente padre queda esperando sin poder leer ni preparar el resto del
trabajo. Una tarea en background devuelve el control enseguida y el padre sigue;
al cerrar el turno, el harness espera, inyecta los resultados y continúa solo.

## What Changes

- `task` acepta `background: true` y devuelve un identificador en vez de esperar.
- Las tareas en background tienen un tope de concurrencia.
- `task_status` consulta una tarea o lista todas, con estado y resultado.
- `task_cancel` cancela una tarea en curso.
- Al terminar el turno del padre, el harness espera las tareas pendientes, inyecta
  el resultado de cada una y arranca un turno de continuación.
- La cancelación del padre cancela sus tareas en background.
- La barra de estado muestra cuántas tareas siguen en curso.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `subagents`: tareas en background, estado, cancelación y continuación del turno.
- `interface`: indicador de tareas en background.

## Impact

- `src/subagents/background.ts`: gestor de tareas, concurrencia y resultados.
- `src/subagents/herramienta.ts`: `background` y extracción del ejecutor.
- `src/subagents/herramientas-background.ts`: `task_status` y `task_cancel`.
- `src/interface/runner.ts`: espera e inyección al cerrar el turno.
- `src/interface/{state,app}.tsx`: conteo de tareas en la barra.
- `src/app.ts`: gestor compartido y alta de las herramientas.
- `tests/subagents/` y `tests/interface/`.
