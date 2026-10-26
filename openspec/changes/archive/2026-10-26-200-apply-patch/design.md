# Design

## Formato del parche

```
*** Begin Patch
*** Add File: src/nuevo.ts
+primera línea
+segunda línea
*** Update File: src/existente.ts
@@ contexto opcional
 línea que queda
-línea que se va
+línea que entra
*** Delete File: src/viejo.ts
*** End Patch
```

Reglas del parser:

- `*** Begin Patch` y `*** End Patch` son obligatorios y en ese orden.
- `*** Add File: <ruta>`: el cuerpo son solo líneas `+`. Un archivo vacío es válido.
- `*** Update File: <ruta>`: el cuerpo son uno o más bloques que empiezan con `@@`.
  Dentro de un bloque, ` ` es contexto, `-` se quita y `+` se agrega. El texto del
  `@@` es una etiqueta informativa y se ignora.
- `*** Delete File: <ruta>`: sin cuerpo.
- Cualquier línea fuera de un bloque, o un prefijo desconocido dentro de un bloque,
  produce un error con el número de línea del parche.

## Algoritmo

1. **Parsear** el parche completo en memoria: intención, ruta, hunks y número de
   línea de origen.
2. **Resolver** cada ruta con `resolverRutaSegura`, que ya rechaza rutas fuera del
   proyecto, symlinks que escapan y rutas sensibles.
3. **Validar** según la intención: agregar exige que no exista, borrar exige que
   exista y sea archivo, actualizar exige leerlo.
4. **Calcular** el contenido resultante de cada archivo en memoria. Los hunks de un
   mismo archivo se aplican en orden sobre el contenido acumulado.
5. **Escribir** solo si todos los bloques pasaron. Agregados y actualizaciones con
   `mkdir` del padre; borrados con `unlink`.

Una actualización localiza la secuencia completa de líneas de contexto y eliminación
en el archivo normalizado a `\n`. Si aparece cero veces o más de una, falla con la
ruta, el número de bloque y el conteo. Los hunks sin líneas `-` ni `+` también fallan.

## Fin de línea

Se reutiliza `detectarEol` / `normalizarEol` / `restaurarEol` de `edit`: se compara
en `\n` y se escribe con el fin de línea original del archivo. Los archivos nuevos
usan `\n`.

## Validación previa y escritura

La validación es total: si un bloque falla, no se escribe ninguno. La escritura no
es transaccional a nivel de disco; si falla a mitad, se intenta restaurar en memoria
los originales y borrar los archivos creados, y el error lo dice. El contrato solo
promete validación previa, no atomicidad ante fallo del disco.

## Contrato de la herramienta

| Campo | Valor |
|---|---|
| `nombre` | `apply_patch` |
| `esquema` | objeto con `patch: string` obligatorio |
| `accionPermiso` | `edit` |
| `obtenerRecurso` | todas las rutas del parche, sin repetir |
| `admiteParalelo` | `false` |
| resultado | resumen por archivo, truncado con `truncarContenido` |

Los errores se lanzan como excepción y el despacho del núcleo los convierte en texto
(`ERROR: ...`), como el resto del catálogo. Los mensajes nombran ruta, bloque y
conteo, nunca el contenido del parche: puede traer secretos.

## Rollback

`src/tools/patch.ts` guarda el contenido original de cada archivo antes de escribir.
Ante un fallo de escritura:

1. reescribe los originales de los archivos ya modificados,
2. borra los archivos que ya se habían creado,
3. propaga un error que nombra la ruta que falló.

Si el rollback también falla, el error lo informa y enumera los archivos que pueden
haber quedado a medias.

## Alternativas descartadas

- **Extender `edit` con un modo multiarchivo**: mezcla dos contratos y rompe el
  esquema simple que ya usa el modelo.
- **Aceptar hunks sin `@@`**: la coincidencia queda ambigua y el error es peor.
- **Escribir archivo por archivo mientras se parsea**: un bloque inválido al final
  dejaría archivos a medio aplicar, justo lo que el requisito prohíbe.

## Pruebas

Un test por escenario del delta, en `tests/tools/`, con el nombre literal del
escenario. Los casos de escritura usan un directorio temporal por test. Se agrega la
herramienta a las comprobaciones de esquema, permiso y paralelo del catálogo.
