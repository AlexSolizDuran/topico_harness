# Proposal

## Why

Las herramientas de archivos usan `node:path` y normalizan separadores, pero
todavía hay diferencias que rompen en Windows: los archivos con fin de línea CRLF
dejan `\r` en cada línea, `edit` no encuentra el texto si el modelo manda LF, y la
comparación de rutas es sensible a mayúsculas en un filesystem que no lo es.
`glob` además recorre `node_modules` y `.git`.

## What Changes

- Leer y buscar dividiendo por `\r?\n` en vez de `\n`.
- Editar comparando con fin de línea normalizado y restaurando el original.
- Resolver rutas con `path.relative` en vez de `startsWith`.
- Comparar rutas sin distinguir mayúsculas en Windows.
- Resolver symlinks antes de aceptar una ruta.
- Compartir una lista de directorios ignorados entre `glob` y `grep`.
- Tests ejecutables desde Linux que simulan Windows con `path.win32`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna. Este change es `skip_specs`: es un bug fix bajo el requisito «Las rutas
se resuelven igual en toda plataforma» y los requisitos de lectura y edición.

## Impact

- `src/tools/path.ts`, `read.ts`, `edit.ts`, `grep.ts`, `glob.ts`.
- `src/tools/eol.ts` (nuevo): detección y restauración de fin de línea.
- `tests/tools/`: tests de CRLF y de rutas Windows.
- Sin cambios en `core`, `provider`, `context` ni `interface`.
