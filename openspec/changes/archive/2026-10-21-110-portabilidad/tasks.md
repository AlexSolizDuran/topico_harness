# Tasks

## 1. Fin de línea

- [x] 1.1 Crear `src/tools/eol.ts` con `detectarEol`, `normalizarEol` y `restaurarEol`; verificar con tests de texto LF, CRLF y mixto.
- [x] 1.2 Cambiar `read.ts` para dividir por `/\r?\n/`; verificar que un tramo de un archivo CRLF no incluye `\r`.
- [x] 1.3 Cambiar `grep.ts` para dividir por `/\r?\n/`; verificar que las líneas reportadas no terminan en `\r`.
- [x] 1.4 Cambiar `edit.ts` para comparar normalizado y restaurar el EOL original; verificar que un archivo CRLF editado con LF queda CRLF.

## 2. Rutas

- [x] 2.1 Refactorizar `resolverRutaSegura` para aceptar `pathApi` inyectable; verificar que los tests existentes siguen pasando.
- [x] 2.2 Reemplazar `startsWith` por `path.relative` y rechazar `..` y rutas absolutas resultantes; verificar los escenarios de adentro y afuera.
- [x] 2.3 Comparar sin distinguir mayúsculas en `win32`; verificar `C:\Proy` contra `c:\proy`.
- [x] 2.4 Resolver `realpath` del ancestro existente más cercano y rechazar symlinks que salgan del proyecto; verificar con un symlink temporal.

## 3. Búsqueda

- [x] 3.1 Crear `src/tools/ignore.ts` con la lista compartida; verificar con tests de cada directorio.
- [x] 3.2 Aplicar la lista en `glob.ts`; verificar que `**/*.ts` no devuelve archivos de `node_modules`.
- [x] 3.3 Reutilizar la lista en `grep.ts` sin cambiar su comportamiento actual; verificar que sigue ignorando `.git` y `node_modules`.

## 4. Tests de plataforma

- [x] 4.1 Agregar tests con `path.win32` inyectado en `tests/tools/portability.test.ts`; verificar rutas dentro, fuera, con `..`, con separadores mezclados y con distinta capitalización.
- [x] 4.2 Agregar tests de EOL con archivos temporales; verificar lectura, búsqueda y edición en CRLF.
- [x] 4.3 Verificar que los 33 escenarios de `tools` siguen cubiertos y que no se rompió ningún test existente.
- [x] 4.4 Correr `npm run check` y verificar lint, typecheck y tests en verde.
