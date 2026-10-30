# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- `ConfiguracionHarness` ya agrupa proveedores, sesiones y defaults; sumar `hooks`
  es una clave más en el mismo validador.
- `dispatch` centraliza la ejecución de herramientas y ya consulta al portero
  antes de ejecutar: es el punto natural para `preTool` y `postTool`.
- `ejecutarTurno` tiene un `finally` por turno donde vive `turnEnd`.
- `REGLAS_BASE` evalúa en orden y gana la última regla que coincide, así que un
  default de `consultar` para `hook` es una línea al final de la lista.
- `src/tools/shell.ts` ya resuelve la ejecución por plataforma; los hooks reusan
  ese mismo mecanismo.

## Goals / Non-Goals

**Goals:**

- Que un hook no se pueda saltear ni olvidar, y que su fallo no rompa el turno.
- Que un repo ajeno no ejecute comandos sin que la persona lo autorice.
- Que el modelo reciba el resultado del hook como texto, en el mismo canal que
  cualquier error.

**Non-Goals:**

- Auto-extracción de memoria: usa `sessionEnd`, pero es otro change.
- Snapshots para deshacer.
- Hooks globales o por agente.

## Decisions

**Los hooks se ejecutan directo, no por el catálogo de comandos.** El catálogo y su
lista negra existen para gobernar comandos que **genera el modelo**. Un hook lo
escribió la persona en su config, con la misma confianza que un script de
`package.json`. Pasarlo por el catálogo obligaría a aprobar cada lint. Alternativa
descartada: tratarlo como `shell`, que pediría aprobación en cada paso.

**El default de la acción `hook` es `consultar`.** El config se versiona desde el
265, así que clonar un repo y abrirlo ejecutaría comandos de ese repo. La primera
vez se pregunta y una aprobación "siempre" lo recuerda por proyecto. Alternativa
descartada: `permitir` por defecto, que convierte cualquier repo en ejecución
arbitraria silenciosa.

**El hook corre después del portero.** Una herramienta denegada no dispara
`preTool`: si el harness ya dijo que no, no tiene sentido validar algo que no va a
pasar. Además, un `2` del hook es un segundo veto independiente, no un reemplazo
del primero.

**`sessionStart` con `2` impide arrancar.** Es la única excepción a "el error vuelve
como texto": todavía no hay turno donde devolverlo, y el caso de uso es justamente
"el repo no está en un estado conocido". Alternativa descartada: avisar y seguir,
que ignora la razón por la que alguien escribió ese hook.

**`turnEnd` y `sessionEnd` con `2` son aviso.** Cuando el trabajo ya terminó no hay
nada que bloquear; tratarlo como bloqueo dejaría la sesión en un estado raro.

**Los hooks de un evento corren en orden de declaración.** El primero que devuelve
`2` corta el resto de ese evento; las notas de los que devolvieron `1` se acumulan.
Así el orden del config es significativo y predecible.

**La salida se trunca a 8 KiB con marcador.** Es lo contrario de la doctrina de
`AGENTS.md`, y a propósito: un log de lint recortado sigue siendo útil, mientras que
un archivo de instrucciones recortado le miente al agente sobre lo que leyó.

**Un hook que no se puede ejecutar es un aviso, no una excepción.** Misma regla que
gobierna las herramientas: el error vuelve como texto y la sesión sigue.

## Risks / Trade-offs

- [Un hook lento frena cada paso] → Timeout de 30 segundos configurable y aviso al vencer.
- [Un hook en un repo ajeno ejecuta código] → Default `consultar` y aprobación recordada por proyecto.
- [Los hooks de subagente multiplican ejecuciones] → Solo `preTool` y `postTool`; `sessionStart` y `sessionEnd` quedan fuera.
- [Windows tiene otra sintaxis] → Se reusa el mecanismo de ejecución por plataforma de la herramienta `shell`.

## Migration Plan

No hay migración: sin la clave `hooks`, nada cambia. Para desactivar un hook
alcanza con borrarlo del config o denegarlo con una regla.
