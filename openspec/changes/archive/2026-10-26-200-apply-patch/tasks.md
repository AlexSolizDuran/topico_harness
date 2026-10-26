# Tasks

## 1. Parser

- [x] 1.1 Crear `src/tools/patch.ts` con el tipo de bloque y el parser del parche.
- [x] 1.2 Exigir `*** Begin Patch` y `*** End Patch`, y rechazar bloques incompletos con el número de línea.
- [x] 1.3 Rechazar líneas fuera de bloque y prefijos desconocidos dentro de un bloque.
- [x] 1.4 Aceptar archivos agregados vacíos y actualizaciones con varios hunks.

## 2. Validación previa

- [x] 2.1 Resolver cada ruta con `resolverRutaSegura` antes de tocar disco.
- [x] 2.2 Exigir que un alta no exista y que un borrado exista.
- [x] 2.3 Calcular en memoria el contenido resultante de cada archivo.
- [x] 2.4 Abortar el parche completo cuando un bloque falla, sin escribir nada.
- [x] 2.5 Informar ruta, bloque y causa sin incluir el contenido del parche.

## 3. Coincidencia y escritura

- [x] 3.1 Aplicar cada hunk solo si su secuencia aparece exactamente una vez.
- [x] 3.2 Devolver el conteo cuando la secuencia aparece varias veces.
- [x] 3.3 Preservar el fin de línea original con `eol.ts`.
- [x] 3.4 Escribir agregados, actualizaciones y borrados, creando directorios padres.
- [x] 3.5 Intentar restaurar los originales si una escritura falla.

## 4. Contrato de la herramienta

- [x] 4.1 Declarar esquema `{ patch: string }`, acción `edit`, recursos múltiples y `admiteParalelo: false`.
- [x] 4.2 Devolver un resumen por archivo truncado con `truncarContenido`.
- [x] 4.3 Registrar la herramienta en `crearCatalogoPorDefecto` y exportarla desde `tools/index.ts`.
- [x] 4.4 Sumarla a `build` en `.harness/agents.json`.

## 5. Pruebas

- [x] 5.1 Un test por cada escenario del delta de `tools`.
- [x] 5.2 Test: un bloque inválido no modifica los archivos de los bloques válidos.
- [x] 5.3 Test: el catálogo expone acción, rutas y `admiteParalelo: false`.
- [x] 5.4 Correr `npm run check` en verde.

## 6. Cierre

- [x] 6.1 Actualizar `AGENTS.md` con la capacidad y los conteos.
- [x] 6.2 `openspec validate 200-apply-patch`.
- [x] 6.3 Archivar el change.
