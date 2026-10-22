# Proposal

## Why

La TUI actual cumple el contrato, pero su presentación es plana: etiquetas
`[Usuario]` y `[Herramienta]`, herramientas que aparecen recién al terminar,
entrada de una sola línea y una única línea de ayuda. No hay forma de ver el
contexto ni de elegir un comando o un modelo sin recordar la sintaxis.

## What Changes

- Barra de estado con modelo, directorio, estado del turno y uso del contexto.
- Mensajes de usuario y asistente sin etiquetas, con separación visual.
- Herramientas como bloques con nombre, argumentos, estado, error y truncado.
- Herramienta visible mientras se ejecuta, no solo al terminar.
- Paleta de comandos y selector de modelo con navegación por teclado.
- Entrada multilínea: `Enter` envía y `Shift+Enter` agrega una línea.
- Historial de pedidos con flechas arriba y abajo.
- Panel `/contexto` con ventana total, presupuesto, uso actual, disponible,
  consumo acumulado y última compactación.
- Se mantiene visible el prompt del sistema, en formato compacto.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `interface`: se agregan requisitos para mostrar el estado de la sesión, ejecutar
  comandos desde una lista, escribir pedidos de varias líneas, mostrar una
  herramienta mientras se ejecuta y mostrar el uso del contexto.

## Impact

- `src/interface/app.tsx`: barra de estado, mensajes, tarjetas y paneles.
- `src/interface/app-interactiva.tsx`: composición, paleta, selector y atajos.
- `src/interface/input.ts`: multilínea, historial y navegación de listas.
- `src/interface/state.ts`: herramienta en curso y métricas de contexto.
- `src/interface/render.tsx` y `src/main.ts`: directorio para la barra de estado.
- `tests/interface/`.
- `openspec/config.yaml` y `AGENTS.md` al cerrar el change.
