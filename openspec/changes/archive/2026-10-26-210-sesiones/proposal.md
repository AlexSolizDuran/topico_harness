# Proposal

## Why

Hoy cerrar el harness pierde la conversación entera. Un turno largo deja de existir
y el siguiente arranca explicando lo mismo otra vez. El Nivel 4 pide persistencia:
guardar la sesión y reanudarla sin reescribir el historial.

## What Changes

- Nueva capacidad `sesiones`: guardado incremental de cada turno en un archivo
  de solo agregado dentro de `.harness/sesiones/`.
- Cada sesión tiene metadatos propios: identificador, fecha, directorio, modelo,
  agente y, cuando corresponde, la sesión de la que se ramificó.
- Un corte a mitad de turno descarta ese turno y conserva los anteriores.
- Reanudar restaura mensajes, modelo, agente y directorio.
- La compactación se registra como un reemplazo del historial, para que al
  reanudar no reviva el contexto que ya se había resumido.
- La credencial se redacta antes de escribir cualquier texto.
- El guardado está activado por defecto y se puede desactivar por configuración.
- La interfaz suma `/sesiones`, `/sesiones <id>`, `/nueva` y muestra la sesión
  activa; la línea de comandos suma `--continuar`, `--sesion <id>` y `--sin-sesion`.
- Se acota la cantidad de sesiones guardadas por proyecto.

## Capabilities

### New Capabilities

- `sesiones`: guardado, carga, listado, reanudación, compactación y límite de
  sesiones por proyecto.

### Modified Capabilities

- `interface`: comandos de sesión, indicador de sesión activa y degradación sin
  terminal.

## Impact

- `src/sesiones/`: formato, almacén, carga y saneamiento.
- `src/interface/runner.ts`: persistencia al cerrar el turno y cambio de sesión.
- `src/interface/{state,app,app-interactiva,commands}.tsx`: historial restaurado,
  comandos y barra de estado.
- `src/provider/config.ts`: bloque `sesiones`.
- `src/args.ts` y `src/main.ts`: `--continuar`, `--sesion`, `--sin-sesion`.
- `src/app.ts`: cableado del almacén.
- `tests/sesiones/` y `tests/interface/`.
- `AGENTS.md` y `.harness/config.example.json`.
