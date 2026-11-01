# Proposal

## Why

El contrato actual de `core` bloquea duro la tercera llamada idéntica. Eso
contradice la decisión de `alcance/nivel-5-configuracion.md`: `doom_loop` es un
permiso que avisa antes de pagar, no un error que decide por la persona. Mientras
el spec diga “no se ejecuta”, el harness no puede pedir aprobación ni dejar que
la persona elija.

Además, el catálogo de acciones de `permissions` no reconoce la detección de
repetición como una acción propia. Sin esa entrada, una regla `doom_loop` no
tiene un vocabulario normativo sobre el que aplicarse.

## What Changes

- `core`: la repetición idéntica consecutiva deja de ser un bloqueo duro y pasa a
  pedir aprobación obligatoria antes de la tercera ejecución.
- `core`: aprobar ejecuta solo esa llamada; denegar devuelve el rechazo como texto
  y deja la firma bloqueada hasta que cambie la herramienta o los argumentos.
- `permissions`: “detectar repetición” se suma al catálogo de acciones, con el
  nombre de la herramienta como recurso.
- `permissions`: la repetición detectada por el núcleo entra en las operaciones que
  siempre piden aprobación, sin opción de guardar una regla.
- `interface` no cambia: la aprobación obligatoria existente ya ofrece solo aprobar
  una vez o denegar y ya muestra el motivo.
- No se toca código de producción, tests ni documentación en este change.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `core`: reemplazar el bloqueo por repetición por una aprobación obligatoria.
- `permissions`: declarar la acción de repetición y su aprobación obligatoria.

## Impact

- Solo specs: `openspec/specs/core/spec.md` y
  `openspec/specs/permissions/spec.md`.
- Sin cambios en `src/` ni en `tests/`.
- Sin dependencias nuevas.
- Al archivar, actualizar los conteos de `AGENTS.md` y `openspec/config.yaml`.
- Fuera de alcance: implementar el detector, agregar tests y endurecer las
  acciones de permiso desconocidas. Eso va en un change de implementación.
