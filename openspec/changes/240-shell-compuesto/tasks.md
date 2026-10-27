# Tasks

## Código

- [x] `AccionPermisoCanon` y `AccionPermiso` incluyen `shell_compuesto` y sus alias.
- [x] `PorteroPermisos.evaluar` y `EntradaHerramienta` aceptan `resolverAccion`.
- [x] El portero resuelve la acción por llamada.
- [x] `MAPA_ACCIONES` incluye `shell_compuesto`.
- [x] `REGLAS_BASE` consulta `shell_compuesto` antes de las reglas de `.env`.
- [x] `shell` divide la línea, valida cada segmento y bloquea la línea completa.
- [x] `shell` trata un intérprete con `-c`/`-e` como compuesto.
- [x] `shell` acepta `directorio` dentro del proyecto.

## Specs

- [x] Delta de `tools` con la validación por segmento y el directorio.
- [x] Delta de `permissions` con la acción y su política base.

## Tests

- [x] Un comando compuesto en Unix se ejecuta si todos los segmentos están en el catálogo.
- [x] Un segmento de la lista negra bloquea la línea completa sin ejecutar nada.
- [x] Un intérprete con `-c` cuenta como compuesto.
- [x] Un comando compuesto pide aprobación y uno simple no.
- [x] El directorio se valida dentro del proyecto.

## Cierre

- [x] `npm run check` en verde.
- [x] `openspec validate --all` en verde.
- [x] `docs/comportamiento.md` actualizado en la sección de `shell`.
