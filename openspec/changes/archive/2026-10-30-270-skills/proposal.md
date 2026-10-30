# Proposal

## Why

Un `AGENTS.md` es contexto que siempre aplica. Un procedimiento —cómo publicar una
release, cómo escribir una migración, cómo revisar un PR— aplica solo a veces. Hoy
no hay lugar para eso: meterlo en `AGENTS.md` lo paga cada request aunque no se use,
y no meterlo deja al agente improvisando.

Las skills resuelven el reparto: se anuncia un catálogo barato y el cuerpo viaja
solo cuando el modelo lo pide. Es además el mecanismo que después necesita la
memoria por tema: índice siempre visible, detalle bajo demanda.

## What Changes

- Nueva capacidad `skills`: al construir la sesión se descubren
  `.opencode/skills/<id>/SKILL.md` y `.opencode/skills/<id>.md`, leyendo solo `name`
  y `description` del frontmatter.
- El prompt de sistema anuncia cada skill con identificador, nombre y descripción.
  El cuerpo no viaja en el anuncio.
- Nueva herramienta `skill({ id })`: devuelve el cuerpo completo, la carpeta base y
  hasta diez rutas de archivos de apoyo. Un id inexistente o denegado vuelve como
  error de texto.
- El cuerpo entregado queda marcado como no recortable, para que el recorte de
  contexto no lo reemplace por el marcador.
- Nueva acción de permiso `skill`, con el identificador como recurso. `denegar` la
  oculta del anuncio y bloquea la invocación; `consultar` pide aprobación.
- Una skill malformada o sin descripción se omite con aviso. Una skill que supera
  los 32 KiB falla el arranque en vez de truncarse.
- Panel `/skills` en la TUI con el catálogo, el estado de carga y las skills
  omitidas; una línea de costo en `/contexto`.
- Fuera de alcance: skills globales, skills por agente, scripts ejecutables,
  recarga en caliente y escritura de skills por el agente.

## Capabilities

### New Capabilities

- `skills`: descubrimiento, anuncio mínimo, carga bajo demanda, permisos y tope.

### Modified Capabilities

Ninguna.

## Impact

- Código: `src/skills/` (nuevo), `src/tools/catalog.ts`, `src/types.ts`,
  `src/permissions/`, `src/app.ts`, `src/interface/`.
- Pruebas: `tests/skills/` (nuevo) y un caso en `tests/context/` para el recorte.
- Documentación: `AGENTS.md`, `openspec/config.yaml`, `docs/comportamiento.md`,
  `PREGUNTAS.md`.
- Sin dependencias nuevas: el frontmatter se parsea a mano.
- Un proyecto sin `.opencode/skills` se comporta exactamente como hoy.
