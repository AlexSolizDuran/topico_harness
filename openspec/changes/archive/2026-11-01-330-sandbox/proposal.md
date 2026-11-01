# Proposal

## Why

El Nivel 7 sigue abierto en su pieza de aislamiento. Hoy el catálogo de comandos,
la lista negra y las aprobaciones son etiquetas de riesgo: ayudan a decidir, pero
no impiden que un comando escriba fuera del proyecto. Un `shell` con un error raro
puede salir del workspace y el harness no tiene un límite del sistema operativo
que lo frene.

## What Changes

- Nueva capacidad `sandbox`: la herramienta de ejecución corre dentro de un
  aislamiento del sistema operativo en las plataformas que lo ofrecen.
- El aislamiento limita las escrituras al proyecto y a un directorio temporal
  propio de la ejecución.
- El aislamiento se aplica a la herramienta completa, no a una clasificación de
  comandos: no depende del catálogo ni de la lista negra.
- Un intento de escribir fuera del proyecto vuelve al modelo como error de texto,
  sin terminar el turno.
- El directorio temporal se crea por ejecución y se limpia al terminar.
- La configuración puede habilitar o deshabilitar el aislamiento; el valor por
  defecto es habilitado.
- En una plataforma sin aislamiento disponible —Windows en la v1— el sistema
  avisa de forma visible y no presenta la ejecución como aislada; siguen vigentes
  los permisos y las aprobaciones.
- `tools`: el resultado de ejecución informa si corrió aislado o no.
- `interface`: muestra el aviso cuando el aislamiento no está disponible.
- Fuera de alcance: implementar el aislamiento, worktrees, sandbox de red y
  aislamiento por comando.

## Capabilities

### New Capabilities

- `sandbox`: aislamiento del sistema operativo para la herramienta de ejecución,
  con límites de escritura, temporal por ejecución y degradación visible.

### Modified Capabilities

- `tools`: el resultado de ejecución declara si el aislamiento estuvo activo.
- `interface`: la interfaz informa cuando la ejecución no está aislada.

## Impact

- Solo specs: `openspec/specs/sandbox/spec.md`, `openspec/specs/tools/spec.md` y
  `openspec/specs/interface/spec.md`.
- Sin cambios en `src/`, `tests/` ni `docs/comportamiento.md`.
- La implementación futura depende de los mecanismos de aislamiento de cada
  plataforma; los specs no nombran ninguno.
- Al archivar, actualizar los conteos de `AGENTS.md` y `openspec/config.yaml`;
  esa higiene va en `360-higiene-alcance`.
- Worktrees quedan fuera por decisión de alcance; se pueden especificar después.
