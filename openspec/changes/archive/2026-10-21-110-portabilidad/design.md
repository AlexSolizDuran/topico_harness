# Design

## Context

Ver `proposal.md` — Why. `resolverRutaSegura` importa `node:path` directamente,
así que no se puede probar el comportamiento de Windows desde Linux. `read` y
`grep` dividen por `\n`. `edit` usa `split(buscar)` exacto. `glob` no filtra
directorios.

## Goals / Non-Goals

**Goals:**

- Que un archivo CRLF se lea, busque y edite igual que uno LF.
- Que las rutas se comporten igual en Linux y Windows.
- Poder testear Windows desde Fedora.

**Non-Goals:**

- Cambiar el formato de respuesta de las herramientas.
- Resolver symlinks en cada operación con costo extra evitable.
- Cambiar la lista negra o el catálogo de comandos (eso es `120`).

## Decisions

### Fin de línea en `src/tools/eol.ts`

```ts
detectarEol(texto): '\r\n' | '\n'
normalizarEol(texto): string      // todo a \n
restaurarEol(texto, eol): string  // vuelve al original
```

- `read` divide por `/\r?\n/`, así el tramo pedido no arrastra `\r`.
- `grep` divide igual y reporta la línea limpia.
- `edit` normaliza contenido y búsqueda, cuenta ocurrencias sobre el texto
  normalizado, reemplaza y restaura el EOL del archivo original.

Alternativa descartada: convertir todo a LF al escribir, que cambiaría archivos
del usuario sin pedirlo.

### Rutas con `relative`

`resolverRutaSegura` recibe un `pathApi` inyectable (por defecto `node:path`):

```
base = pathApi.resolve(directorioProyecto)
abs  = pathApi.resolve(base, ruta)
rel  = pathApi.relative(base, abs)
if (rel.startsWith('..') || pathApi.isAbsolute(rel)) → ErrorRutaInvalida
```

En `win32` la comparación se hace sobre `toLowerCase()`. Se valida también que la
ruta real (`realpath`) siga dentro del proyecto cuando el archivo exista; si no
existe (por ejemplo, un `write` a una ruta nueva), se valida el ancestro existente
más cercano.

### Directorios ignorados compartidos

`src/tools/ignore.ts` con `debeIgnorar(ruta)` para `node_modules`, `.git`,
`.vitest`, `coverage` y `dist`. Lo usan `glob` y `grep`. Alternativa descartada:
duplicar la lista, que ya se desincronizó una vez.

### Tests de Windows desde Linux

`resolverRutaSegura(ruta, base, path.win32)` permite probar:
`C:\proy\src\a.ts` dentro, `C:\otro\a.ts` fuera, separadores mezclados, mayúsculas
distintas y rutas con `..`. Los tests de EOL corren en cualquier plataforma
creando archivos temporales con `\r\n`.

## Risks / Trade-offs

- [Cambiar `read` para dividir por regex altera los números de línea] → se
  conserva el 1-indexado y el `THEN` de los escenarios existentes.
- [Restaurar el EOL puede mezclar si el archivo ya tenía ambos] → se usa el EOL
  dominante; un archivo mixto se normaliza al dominante y se documenta.
- [`realpath` falla en un `write` a ruta nueva] → se resuelve el ancestro
  existente; si no hay ninguno, se rechaza.
- [Windows con mayúsculas: comparar en minúsculas puede aceptar rutas distintas
  que el FS considera iguales] → es exactamente el comportamiento esperado.
- [Tests con `path.win32` no prueban el filesystem real] → cubren la lógica de
  resolución; la ejecución real queda para CI de Windows cuando exista.
