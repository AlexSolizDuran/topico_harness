# Tasks

## 1. Mecanismo de aprobación obligatoria

- [x] 1.1 `EvaluacionPermiso` y `SolicitudAprobacion` suman `obligatoria` y `motivo`.
- [x] 1.2 `EntradaHerramienta` y `PorteroPermisos` aceptan `motivoAprobacionObligatoria`.
- [x] 1.3 El portero fuerza `consultar` obligatoria salvo `denegar` configurado.
- [x] 1.4 El portero normaliza `siempre` a `una_vez` en una aprobación obligatoria.
- [x] 1.5 `core` propaga `obligatoria` y `motivo` en la solicitud.

## 2. Shell

- [x] 2.1 Un analizador de línea reconoce composición, redirecciones y descriptores.
- [x] 2.2 `shell` declara el motivo: lista negra, catálogo, sustitución, redirección, intérprete, Windows y directorio.
- [x] 2.3 `shell` deja de rechazar y ejecuta después de la aprobación.
- [x] 2.4 La acción `shell_redireccion` se resuelve por llamada.
- [x] 2.5 `/dev/null` y la duplicación de descriptores no piden aprobación.

## 3. Rutas

- [x] 3.1 `resolverRuta` y `evaluarRiesgoRuta` reemplazan a `resolverRutaSegura`.
- [x] 3.2 `read`, `write`, `edit` y `apply_patch` declaran el motivo de ruta.
- [x] 3.3 Las herramientas resuelven sin restricción y ejecutan tras la aprobación.

## 4. Permisos e interfaz

- [x] 4.1 `shell_redireccion` entra en el mapa de acciones y en la política base.
- [x] 4.2 El panel muestra el motivo y oculta "aprobar siempre" cuando es obligatoria.
- [x] 4.3 El atajo `2`/`a` se ignora en una aprobación obligatoria.

## 5. Specs

- [x] 5.1 Delta de `tools` con los requisitos de lista negra, catálogo, redirecciones y rutas.
- [x] 5.2 Delta de `permissions` con la aprobación obligatoria y la acción nueva.
- [x] 5.3 Delta de `interface` con el motivo y las dos salidas.

## 6. Pruebas

- [x] 6.1 Un test por escenario de `tools`.
- [x] 6.2 Un test por escenario de `permissions`.
- [x] 6.3 Un test por escenario de `interface`.
- [x] 6.4 Actualizar los tests que afirmaban el rechazo.

## 7. Cierre

- [x] 7.1 `docs/comportamiento.md` actualizado.
- [x] 7.2 `AGENTS.md`, `openspec/config.yaml`, `PREGUNTAS.md` y `alcance/` actualizados.
- [x] 7.3 `npm run check` en verde.
- [x] 7.4 `openspec validate --all` en verde.
- [x] 7.5 Archivar el change.
