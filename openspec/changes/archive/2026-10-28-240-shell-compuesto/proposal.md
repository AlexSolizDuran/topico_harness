# Proposal

## Why

La herramienta `shell` solo acepta una invocación simple. En la práctica el
trabajo real pide encadenar: instalar y después probar, buscar y después editar,
correr un script y revisar la salida. Hoy el modelo tiene que partir eso en varias
llamadas, y cada llamada extra gasta un paso del turno. Además, la defensa actual
no es real: `bash -c "rm -rf …"` pasa el filtro porque el encadenamiento vive
dentro de las comillas y solo se mira el primer token.

## What Changes

- En Unix, una línea puede componer varios comandos con `;`, `&&`, `||` y `|`.
- Cada segmento se valida contra el catálogo y la lista negra de la plataforma.
  Un segmento prohibido bloquea la línea completa antes de ejecutar nada.
- Una línea compuesta se evalúa con la acción `shell_compuesto`, cuya política
  base es `consultar`: pide aprobación con la línea completa a la vista.
- Un intérprete con `-c` o `-e` (`bash -c`, `node -e`, `python3 -c`) cuenta como
  compuesto aunque no tenga operadores. Eso cierra el bypass actual.
- La herramienta acepta un `directorio` de trabajo dentro del proyecto, para no
  encadenar `cd` con la tarea.
- En Windows la composición se sigue rechazando: el parseo de PowerShell no es
  el de `sh` y una media implementación sería peor que el rechazo.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `tools`: validación por segmento y directorio de trabajo.
- `permissions`: acción `shell_compuesto` y su política base.

## Impact

- `src/tools/shell.ts`, `src/permissions/`, `src/core/registry.ts`, `src/types.ts`.
- El modo no interactivo degrada `consultar` a `denegar`: sin terminal, un
  comando compuesto no se ejecuta. Es el comportamiento ya especificado para las
  aprobaciones.
- Fuera de alcance: validar redirecciones (`>`, `>>`), aquí heredocs y
  sustitución de procesos. Los dos primeros ya eran posibles con un comando
  simple; el tercero se sigue rechazando.
