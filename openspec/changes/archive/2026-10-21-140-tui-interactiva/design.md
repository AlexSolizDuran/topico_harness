# Design

## Context

La TUI usa `Static` para el historial terminado y una caja viva para streaming,
spinner y avisos. `herramienta_inicio` ya trae nombre y argumentos, pero
`state.ts` los descarta y recién crea un elemento en `herramienta_fin`. La
entrada es un buffer de una línea y el único comando es `/modelo`.

## Goals / Non-Goals

**Goals:**

- Acercar la presentación a un agente de terminal moderno sin cambiar el núcleo.
- Mostrar la herramienta desde que empieza.
- Poder elegir comandos y modelos con el teclado.
- Mostrar el contexto total y el uso actual.
- Mantener el modo línea a línea y los tests deterministas.

**Non-Goals:**

- Pantalla completa con buffer alternativo o scroll propio.
- Sidebar, sesiones persistentes, agentes, permisos, mouse o temas.
- Cambiar `core/`, `provider/` o `tools/`.
- Ocultar el prompt del sistema: el spec exige que siga visible.

## Decisions

### Historial terminado y herramienta en curso

`Static` no se puede actualizar. La herramienta en curso vive fuera de `Static`,
en la caja viva, y recién al recibir `herramienta_fin` se mueve al historial.
Así la tarjeta no queda congelada sin resultado.

`EstadoSesionVisual` agrega `herramientaEnCurso` con id, nombre y argumentos.
`aplicarEventoTurno` lo crea en `herramienta_inicio` y lo limpia en
`herramienta_fin`, empujando el resultado al historial con los argumentos.

### Estado y métricas

`EstadoSesionVisual` agrega `contexto`, calculado por `SesionInteractiva` a partir
de `PresupuestoContexto` y `calcularTokensHistorial`. La interfaz no calcula
tokens: solo muestra lo que la sesión expone.

### Entrada y comandos

La lógica de la paleta, el selector y el multilínea vive en reducers puros de
`input.ts` cuando es posible; el componente solo conecta `useInput`. Los overlays
tienen prioridad sobre la entrada normal: mientras están abiertos, las flechas y
`Enter` navegan la lista y `Esc` la cierra.

### Multilínea

`Enter` envía. `Shift+Enter` inserta `\n`; `Ctrl+J` queda como alternativa para
terminales que no distinguen `Shift+Enter`. Pegar texto conserva los saltos de
línea.

### Sin dependencias nuevas

Se resuelve con Ink, React y Unicode. No se agrega una librería de componentes ni
un parser de Markdown. El texto del asistente se muestra tal como llega.

### Prompt del sistema

Se mantiene visible, pero sin una caja que ocupe media pantalla: una etiqueta
compacta y el texto en gris. No se modifica el requisito de visibilidad.

## Risks / Trade-offs

- [`Shift+Enter` no funciona en todas las terminales] → `Ctrl+J` como alternativa
  documentada en la ayuda.
- [La tarjeta de herramienta no se puede actualizar dentro de `Static`] → se
  mantiene en la caja viva hasta que termina.
- [Los overlays compiten con la entrada normal] → prioridad explícita y tests del
  reducer.
- [La barra de estado puede truncar rutas largas] → se muestra la parte final y
  el panel `/contexto` no depende de ella.
- [Más estado visual puede romper tests existentes] → se actualizan los asserts y
  se agregan tests de los escenarios nuevos.

## Migration Plan

No hay migración de datos. Los componentes actuales se reemplazan de forma
incremental y el modo línea a línea conserva la misma información. Al archivar,
el delta de `interface` agrega los cinco requisitos nuevos.
