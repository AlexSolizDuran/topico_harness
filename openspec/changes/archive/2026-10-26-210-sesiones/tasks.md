# Tasks

## 1. Formato y almacén

- [x] 1.1 Crear `src/sesiones/formato.ts` con metadatos, registros, saneamiento y validación.
- [x] 1.2 Crear `src/sesiones/almacen.ts` con rutas, creación, carga, listado y última.
- [x] 1.3 Implementar la reproducción con reemplazo por compactación.
- [x] 1.4 Descartar solo el último registro inválido; fallar si el inválido está en el medio.
- [x] 1.5 Escribir con `0600` y directorios `0700`, en modo solo agregado.
- [x] 1.6 Implementar la poda por `maximo` sin tocar la sesión activa.

## 2. Configuración y CLI

- [x] 2.1 Agregar `sesiones: { guardar, maximo }` a `ConfiguracionHarness` y su validación.
- [x] 2.2 Agregar `--continuar`, `--sesion <id>` y `--sin-sesion` a `parsearArgumentos` y la ayuda.
- [x] 2.3 Resolver la sesión a cargar en `main.ts` y devolver código 1 si el id no existe.
- [x] 2.4 Informar el identificador de la sesión en modo línea a línea.

## 3. Sesión

- [x] 3.1 Crear el almacén en `construirHarness` salvo que el guardado esté desactivado.
- [x] 3.2 Guardar la diferencia de mensajes al cerrar cada turno, incluido cancelado o fallido.
- [x] 3.3 Guardar el reemplazo de historial cuando hay compactación.
- [x] 3.4 Restaurar mensajes, modelo, agente y directorio al reanudar.
- [x] 3.5 Actualizar metadatos al cambiar de modelo o de agente.
- [x] 3.6 Implementar `nuevaSesion`, `cambiarSesion`, `listarSesiones` y `obtenerSesionId`.
- [x] 3.7 Rechazar el cambio de sesión durante un turno.

## 4. Interfaz

- [x] 4.1 Sumar `/sesiones` y `/nueva` a `commands.ts` y a la ejecución de comandos.
- [x] 4.2 Mostrar el identificador en `BarraEstado`.
- [x] 4.3 Reconstruir el historial visual desde los mensajes al reanudar.

## 5. Pruebas

- [x] 5.1 Un test por escenario del delta de `sesiones`.
- [x] 5.2 Un test por escenario del delta de `interface`.
- [x] 5.3 Test de punta a punta: guardar, cerrar, reanudar y seguir con el historial.
- [x] 5.4 Correr `npm run check` en verde.

## 6. Cierre

- [x] 6.1 Actualizar `AGENTS.md`, `PREGUNTAS.md`, `alcance/decisiones-abiertas.md` y `config.example.json`.
- [x] 6.2 `openspec validate 210-sesiones`.
- [x] 6.3 Archivar el change.
