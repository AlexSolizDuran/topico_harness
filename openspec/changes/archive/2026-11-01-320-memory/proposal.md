# Proposal

## Why

El Nivel 8 sigue abierto. `instructions` ya carga lo estable del proyecto
(`AGENTS.md`), pero nada de lo aprendido sobrevive al cierre: convenciones
descubiertas, decisiones tomadas, errores ya intentados y ubicaciones no obvias se
pierden y hay que repetirlos en la sesión siguiente.

La memoria es el eje que mejora la próxima sesión, no la actual, y es la molestia
diaria aunque no rompa nada.

## What Changes

- Nueva capacidad `memory`: carga del índice y del detalle de la memoria del
  proyecto al arrancar, con el detalle bajo demanda.
- Separación explícita entre instrucciones estables (`AGENTS.md`) y memoria
  aprendida (`memoria/`).
- Inyección de la memoria como bloque de sistema marcado, contabilizado en el
  presupuesto de contexto.
- Auto-extracción al cerrar la sesión con un modelo de bajo costo, guardando solo
  hechos no deducibles del código.
- Curación: índice pequeño, archivos por tema, edición manual y marcado de
  entradas obsoletas o contradictorias.
- Ámbito de proyecto por defecto y de usuario opcional, sin mezclar proyectos.
- Tope configurable que falla con un error explícito en vez de truncar.
- Fuera de alcance: implementar el comportamiento, panel de memoria en la
  interfaz, sincronización entre máquinas y curación automática sin intervención.

## Capabilities

### New Capabilities

- `memory`: carga, inyección, extracción, curación, ámbito y topes de la memoria
  aprendida entre sesiones.

### Modified Capabilities

Ninguna.

## Impact

- Solo specs: `openspec/specs/memory/spec.md`.
- Sin cambios en `src/`, `tests/` ni `docs/comportamiento.md`.
- La implementación futura reusa `hooks` (`sessionEnd`), `instructions`,
  `context` y la acción de permiso `edit`; no requiere una acción nueva.
- Al archivar, actualizar los conteos de `AGENTS.md` y `openspec/config.yaml`;
  esa higiene va en `360-higiene-alcance`.
- Sin dependencias nuevas.
