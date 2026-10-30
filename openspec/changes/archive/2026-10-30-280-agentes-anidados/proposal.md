# Proposal

## Why

El 260 carga un solo `AGENTS.md`: el de la raíz. En un monorepo eso obliga a elegir
entre un archivo genérico que no sirve para ninguna carpeta o uno gigante que mete
las convenciones de `packages/web` en el turno que trabaja sobre `packages/api`.

La solución es la de OpenCode: el archivo entra cuando el agente entra a la
carpeta. El catálogo de instrucciones crece con la exploración y se paga solo por
lo que se usa.

## What Changes

- Al explorar una ruta con una herramienta de archivo, el sistema busca
  `AGENTS.md` en ese directorio y en sus ancestros hasta la raíz del proyecto, y
  carga los que todavía no estén cargados.
- La carga ocurre dentro del turno: el prompt de sistema se recompone antes de la
  siguiente petición, así que el agente ve las instrucciones antes de actuar sobre
  esa carpeta.
- `shell`, `grep` y un `glob` sin prefijo de directorio no disparan la carga: son
  búsquedas o ejecuciones, no entradas a una carpeta.
- Cada archivo se carga una sola vez por sesión, identificado por su ruta real. El
  registro sobrevive a la compactación.
- Orden del prompt: raíz, después ancestros de afuera hacia adentro, después el
  prompt del agente.
- Tope total configurable de 64 KiB, además del tope por archivo de 32 KiB. Si un
  archivo nuevo lo supera a mitad de turno, el error vuelve como texto y el turno
  continúa.
- Evento visible por cada archivo cargado, con ruta, tamaño y tokens, sumado a
  `tokensSistema`.
- Los subagentes heredan las instrucciones que el padre tenía al lanzarse y no
  cargan otras.
- Fuera de alcance: recarga en caliente, archivos fuera del proyecto, detección de
  rutas dentro de `shell`, carga propia en subagentes.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `instructions`: se habilita la carga por exploración y se agregan deduplicación,
  precedencia, tope total y visibilidad. El requisito de carga al arrancar se
  ajusta para admitir archivos anidados sin dejar de excluir otros nombres.

## Impact

- Código: `src/instructions/`, `src/core/registry.ts`, `src/core/dispatch.ts`,
  `src/core/turn.ts`, `src/interface/runner.ts`, `src/types.ts`,
  `src/subagents/`.
- Pruebas: `tests/instructions/` (se amplía) y `tests/core/` para el prompt por
  paso.
- Documentación: `AGENTS.md`, `openspec/config.yaml`, `docs/comportamiento.md`,
  `PREGUNTAS.md`, `alcance/nivel-8-memoria.md`.
- Dependencia de secuencia: este change modifica `instructions`, que recién existe
  cuando se archiva `260-instrucciones-proyecto`. Hay que archivarlo antes.
