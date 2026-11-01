# Proposal

## Why

El Nivel 6 quedó a medio cerrar. Las cinco etapas de compactación ya existen, pero
faltan las tres piezas que hacen que una sesión larga siga siendo útil y barata:
recordatorios que evitan la degradación por atención, un prefijo de petición
estable que permita aprovechar la caché del provider, y una cola de salida para
que un log grande no llene el contexto.

Sin esto, el harness compacta bien pero el modelo se desvía, cada viaje paga el
prefijo completo y un `npm test` verboso sigue llegando entero al modelo.

## What Changes

- `context`: recordatorios deterministas como mensajes de sistema. Después de
  editar, sugiere verificar; después de N pasos sin escribir, reinyecta el
  objetivo original; después de compactar, avisa que el historial fue resumido.
- `context`: el objetivo original se conserva fuera del historial compactable,
  para poder reinyectarlo aunque la compactación haya borrado el pedido.
- `provider`: el prefijo de la petición se mantiene estable dentro de un turno:
  prompt de sistema al inicio, herramientas en orden estable e historial que solo
  crece por agregado.
- `tools`: la salida de la herramienta de ejecución se entrega al modelo como
  cola, con una marca de lo omitido y la forma de recuperar la salida completa.
- `interface`: la persona sigue viendo la salida completa aunque el modelo reciba
  solo la cola.
- Fuera de alcance: implementar el comportamiento, cambiar las cinco etapas de
  compactación, generar recordatorios con el modelo y agregar tests.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `context`: recordatorios de sistema y conservación del objetivo original.
- `provider`: estabilidad del prefijo de la petición.
- `tools`: entrega de la salida de ejecución como cola.
- `interface`: conservación de la salida completa de ejecución.

## Impact

- Solo specs: `openspec/specs/context/spec.md`, `openspec/specs/provider/spec.md`,
  `openspec/specs/tools/spec.md` y `openspec/specs/interface/spec.md`.
- Sin cambios en `src/`, `tests/` ni `docs/comportamiento.md`.
- Al archivar, actualizar los conteos de `AGENTS.md` y `openspec/config.yaml`;
  esa higiene va en `360-higiene-alcance`.
- Sin dependencias nuevas.
