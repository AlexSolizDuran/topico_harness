# Design

## Context

Ver `proposal.md` — Why. El código existente ya expone `crearCatalogoPorDefecto`,
`SesionInteractiva`, `detectarTerminalInteractiva` y `RenderizadorLineaALinea`.
Lo que falta es el punto de entrada y las decisiones de empaquetado.

## Goals / Non-Goals

**Goals:**

- Un comando que arranca y opera sobre el directorio del usuario.
- Desarrollo sin build (`tsx`) y binario global con build (`tsc`).
- Un solo lugar de ensamblado, testeable sin proceso hijo.

**Non-Goals:**

- TUI Ink (llega en `080-tui-ink`).
- Provider real (llega en `070-provider-real`).
- Selección de modelo por flags o en caliente (llega en `100-modelo-caliente`).

## Decisions

### `src/main.ts` fino + `src/app.ts` con el ensamblado

`main.ts` solo parsea argumentos, arma el ensamblado y elige salida. La función
`construirHarness(opciones)` vive en `src/app.ts` y devuelve
`{ sesion, registro }`, para poder testear el cableado sin spawnear un proceso.
Alternativa descartada: testear `main.ts` con `child_process`, que es lento y
frágil.

### Desarrollo con `tsx`, distribución con `tsc`

`tsx` resuelve imports `.js` contra `.ts` y soporta JSX. Se usa solo en `dev`.
`tsconfig.build.json` compila a `dist/` con `rootDir: "src"` y `noEmit: false`.
El `bin` apunta a `./dist/main.js` con shebang. Alternativa descartada: Node 24
con type stripping, que no resuelve las extensiones `.js` del proyecto.

### Un solo modo de salida en este change

Se usa `RenderizadorLineaALinea` siempre. La TUI llega en `080`; adelantarla acá
mezcla dos comportamientos y duplica el trabajo de tests.

### Detección de terminal

`detectarTerminalInteractiva` hoy mira solo `stdout.isTTY`. Se amplía a
`stdin.isTTY && stdout.isTTY`: con stdin pipeado no se puede escribir, aunque
stdout sea una terminal. Es un cambio de comportamiento del helper, no del
contrato.

### Directorio del proyecto

`--dir <ruta>` explícito; si falta, `process.cwd()`. El directorio se resuelve
una vez y se pasa a `crearCatalogoPorDefecto`, que ya lo usa como raíz de rutas.

### Códigos de salida

`0` si el turno terminó `completado`; `1` si terminó `fallido` o si el arranque
falló (credencial faltante, config inválida). Los errores van a `stderr`, nunca
a `stdout`, para no contaminar la salida redirigible.

## Risks / Trade-offs

- [El `bin` global no encuentra `dist/`] → `prepare` ejecuta el build al instalar
  o enlazar; documentar `npm run build && npm link`.
- [Un `--dir` inválido resuelve a un directorio inexistente] → validar con
  `stat` antes de armar el catálogo y salir con `1`.
- [Windows sin TTY] → el modo línea a línea ya es el único de este change, así
  que no hay diferencia.
- [Tests de integración lentos] → un solo test de proceso hijo; el resto prueba
  `construirHarness()` en memoria.

## Migration Plan

No hay usuarios ni datos que migrar. El comando convive con `npm run dev`.
Rollback: quitar `bin` y scripts; el resto del código no depende de este change.
