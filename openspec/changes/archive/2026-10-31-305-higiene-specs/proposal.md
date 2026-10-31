# Proposal

## Why

El contrato de permisos quedó atrás del código en tres puntos. `skill` y `hook`
existen como acciones en la implementación y en sus propias capacidades, pero el
catálogo de acciones de `permissions` no las menciona. Las definiciones de agente
aceptan reglas de permiso y las validan, pero `agents` no declara ese campo. El
panel `/skills` está implementado y se usa en la TUI, pero ninguna capacidad lo
exige.

Eso no rompe el comportamiento de hoy. Rompe el contrato: un cambio futuro podría
borrar o cambiar esas piezas sin que ningún requisito lo impida. Antes de agregar
`doom_loop` al mismo catálogo de acciones, conviene dejar el catálogo completo.

## What Changes

- `permissions`: el catálogo de acciones incluye cargar skill y ejecutar hook, con
  el identificador de la skill y el nombre del evento como recursos.
- `agents`: la definición declarativa puede incluir reglas de permiso; una regla
  con forma inválida falla el arranque en vez de ignorarse.
- `interface`: se especifica `/skills` como panel con el catálogo, el estado de
  carga, las skills omitidas y un estado vacío.
- No se modifica ningún comportamiento existente.
- No se toca código de producción, tests ni documentación en este change.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `permissions`: completar el catálogo de acciones.
- `agents`: declarar permisos por agente y su validación.
- `interface`: declarar el panel `/skills`.

## Impact

- Solo specs: `openspec/specs/permissions/spec.md`,
  `openspec/specs/agents/spec.md` y `openspec/specs/interface/spec.md`.
- Sin cambios en `src/` ni en `tests/`.
- Sin dependencias nuevas.
- Al archivar, actualizar los conteos de `AGENTS.md` y `openspec/config.yaml`.
- Fuera de alcance: endurecer las acciones desconocidas y agregar tests para los
  escenarios nuevos. Ambas cosas cambian o verifican comportamiento y merecen su
  propio change.
