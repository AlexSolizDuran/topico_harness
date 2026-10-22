# Design

## Context

Ver `proposal.md` — Why. Ink 7.1.1 exporta `render`, `Static`, `useInput`,
`useApp` y `renderToString`, y `render` acepta `exitOnCtrlC: false`. El reducer
`aplicarEventoTurno` y los componentes de `app.tsx` ya existen y se reutilizan.
`SesionInteractiva` ya notifica con `alActualizar` pero no devuelve el estado
final ni expone errores.

## Goals / Non-Goals

**Goals:**

- Escribir y enviar pedidos con streaming visible.
- Cancelar con `Ctrl+C` sin matar el proceso.
- Tests deterministas sin depender de una terminal real.

**Non-Goals:**

- Cambiar de modelo (`100-modelo-caliente`).
- Historial entre procesos o sesiones persistentes.
- Ratón, scroll manual, temas o configuración visual.

## Decisions

### Reducer de teclas puro en `src/interface/input.ts`

`aplicarTecla(estadoEntrada, tecla)` devuelve `{ buffer, cursor, accion }` con
acciones `enviar`, `cancelar`, `salir` o `ninguna`. El componente solo conecta
`useInput` a esa función. Alternativa descartada: lógica de edición dentro del
componente, imposible de testear sin renderizar.

### Estado de la TUI con `useState` y `alActualizar`

`SesionInteractiva` acepta `alActualizar` y lo llama en cada evento. La TUI pasa
`setEstado`. El estado visual sigue siendo el de `state.ts`, sin duplicar el
historial en React.

### `Static` para lo terminado, caja viva para lo que cambia

El historial completo va dentro de `<Static>` para que quede en el scrollback y
no se redibuje. Fuera de `Static` quedan solo el texto en streaming, el spinner,
el aviso de cancelación y la línea de entrada. Es lo que evita el parpadeo.

### `Ctrl+C` en dos tiempos

Con `exitOnCtrlC: false`, `Ctrl+C` llama a `sesion.cancelar()` si hay turno en
curso. Si no hay turno, sale con `useApp().exit()`. `Ctrl+D` sale siempre.
Alternativa descartada: matar el proceso con `Ctrl+C`, que pierde el turno y deja
la terminal sin restaurar.

### Errores visibles

`runner.ts` atrapa el error de `ejecutarTurno`, lo convierte en un elemento
`aviso` con el mensaje sanitizado y lo deja en el historial. El `catch` vacío
actual se elimina. `enviarMensaje` devuelve el `EstadoTurno` para que `main.ts`
decida el código de salida.

### Tests sin terminal

- Reducer de teclas: tests puros.
- Render: `renderToString(<AppHarness estado={...} />)` para el contenido.
- Sesión: `SesionInteractiva` con `ProveedorSimulado`, sin Ink.
- Un test de humo con `render` y stdin simulado queda fuera; si más adelante se
  agrega `ink-testing-library`, se evalúa entonces.

## Risks / Trade-offs

- [Ink y terminales Windows] → el modo interactivo solo se activa con
  `stdin.isTTY && stdout.isTTY`; en el resto se usa línea a línea.
- [`useInput` no recibe pegado largo como una sola tecla] → se usa `usePaste`
  para insertar el texto completo en el buffer.
- [Redibujar el historial completo en cada delta] → `Static` lo impide; solo se
  redibuja la caja viva.
- [Cancelar mientras se escribe] → `Ctrl+C` cancela; el buffer no se pierde
  porque no se limpia hasta que el envío se completa.
- [Un error de la sesión deja la UI colgada] → todo camino termina en
  `finalizarTurnoVisual` dentro de un `finally`.
