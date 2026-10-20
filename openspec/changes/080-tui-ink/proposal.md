# Proposal

## Why

La interfaz existe como reducer y como componentes presentacionales, pero no hay
entrada de teclado ni TUI: `app.tsx` solo dibuja un estado que nadie actualiza, y
`RenderizadorLineaALinea` cubre únicamente el modo sin terminal. El requisito
«la interfaz permite escribir el siguiente pedido» está especificado y hoy no se
puede cumplir en modo interactivo.

## What Changes

- Componente interactivo con estado, entrada de teclado y streaming en vivo.
- Historial fijo en el scrollback y área viva separada para el turno en curso.
- Edición básica de la línea: escribir, borrar, mover cursor, pegar.
- `Enter` envía; `Ctrl+C` cancela el turno en curso y sale si no hay turno;
  `Ctrl+D` sale.
- Error de turno visible en pantalla en vez de silenciado.
- `SesionInteractiva` devuelve el `EstadoTurno` y expone los fallos a la interfaz.
- La interfaz sigue sin lógica de negocio: parsea teclas y delega en la sesión.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna. Este change es `skip_specs`: materializa los requisitos de `interface`
sobre entrada, cancelación y modo interactivo completo.

## Impact

- `src/interface/app-interactiva.tsx` (nuevo).
- `src/interface/input.ts` (nuevo): reducer puro de teclas.
- `src/interface/render.tsx` (nuevo): `render` con `exitOnCtrlC: false`.
- `src/interface/runner.ts`: `enviarMensaje` devuelve `EstadoTurno`, notifica
  fallos y acepta un `alTerminar`.
- `src/interface/state.ts`: soporte para el aviso de error.
- `src/main.ts`: elige TUI o línea a línea según la terminal.
- `tests/interface/`: tests del reducer de entrada y del render con `renderToString`.
