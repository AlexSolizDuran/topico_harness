# Proposal

## Why

Hoy el harness bloquea capacidades en lugar de consultarlas: la lista negra de
`shell`, el catálogo de comandos, `$()`, la composición en Windows y las rutas
fuera del proyecto o sensibles. La decisión la toma el código, no la persona, y el
sistema no puede hacer todo lo que el usuario podría querer.

Además, la lista negra no es una defensa real. `bash -c`, un script ejecutado por
`node` o una redirección esquivan el análisis. Bloquear unos casos y dejar pasar
otros da una falsa sensación de seguridad.

La decisión correcta es la inversa: **nada se bloquea**. Lo riesgoso se ejecuta
solo con una aprobación obligatoria, con el motivo a la vista. La lista negra y el
catálogo dejan de ser un muro y pasan a ser etiquetas de riesgo.

## What Changes

- Una operación marcada como riesgosa por la herramienta **siempre** pide
  aprobación. No se puede saltar con "aprobar siempre" ni con una regla
  `permitir`; solo una regla `denegar` configurada la impide.
- Sin terminal interactiva, la aprobación obligatoria se deniega: no hay a quién
  preguntar.
- `shell` deja de rechazar. Piden aprobación obligatoria:
  - un comando de la lista negra;
  - un comando fuera del catálogo de la plataforma;
  - una línea con `$()` o backticks;
  - una línea que compone comandos en Windows;
  - una redirección a un archivo, un heredoc, un herestring o una sustitución de
    proceso;
  - una invocación a un intérprete con una bandera de código (`-c`, `-e`,
    `--eval`);
  - un `directorio` de trabajo fuera del proyecto o sensible.
- `read`, `write`, `edit` y `apply_patch` dejan de rechazar rutas. Piden
  aprobación obligatoria una ruta fuera del proyecto y una ruta sensible
  (`.env`, `.env.*`, `.harness/**`). `.env.example` sigue permitido.
- `glob` y `grep` no cambian: no aceptan una ruta, siempre buscan en el proyecto.
- La interfaz muestra el motivo y, en una aprobación obligatoria, solo ofrece
  aprobar una vez o denegar.
- `2>&1`, `n>&m`, `n>&-`, `> /dev/null` y `2>/dev/null` no tocan un archivo real:
  siguen siendo una invocación simple.

## Capabilities

### New Capabilities

- Ninguna.

### Modified Capabilities

- `tools`: la lista negra, el catálogo, la sustitución de comandos, las
  redirecciones y las rutas dejan de rechazar y pasan a pedir aprobación
  obligatoria.
- `permissions`: una operación riesgosa siempre consulta; la aprobación
  obligatoria no se puede saltar y ofrece dos salidas.
- `interface`: el panel de aprobación muestra el motivo y oculta "aprobar
  siempre" cuando la aprobación es obligatoria.

## Impact

- `src/tools/shell.ts`, `src/tools/path.ts`, `src/tools/read.ts`,
  `src/tools/write.ts`, `src/tools/edit.ts`, `src/tools/patch.ts`.
- `src/permissions/portero.ts`, `src/permissions/reglas.ts`, `src/types.ts`.
- `src/core/batches.ts`, `src/core/dispatch.ts`, `src/interface/app.tsx`,
  `src/interface/app-interactiva.tsx`.
- `AGENTS.md`, `openspec/config.yaml`, `PREGUNTAS.md`, `alcance/` y
  `docs/comportamiento.md`.
- La credencial configurada se sigue redactando al persistir la sesión. Aprobar
  la lectura de `.env` manda su contenido al modelo; es una consecuencia
  consciente de esta decisión.
