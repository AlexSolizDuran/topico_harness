# Tasks

## 1. Carga por exploración

- [ ] 1.1 Sumar `rutasExploradas` a `EntradaHerramienta` y declararlo en `read`, `write`, `edit` y `patch` (extrayendo rutas de los encabezados del parche); verificar con tests de `tests/instructions/` que cada tool reporta su ruta.
- [ ] 1.2 Declarar el prefijo de directorio en `glob` cuando el patrón lo tenga, y no declarar nada en `grep` ni en `shell`; verificar los escenarios de glob con y sin prefijo y el de búsqueda de texto.
- [ ] 1.3 Implementar en `src/instructions/` la búsqueda de `AGENTS.md` por ancestros hasta la raíz y el registro de cargados por ruta real; verificar los escenarios de subcarpeta con archivo propio y sin archivo propio.

## 2. Cableado del turno

- [ ] 2.1 Aceptar `sistema` como string o función en `ejecutarTurno` y resolverlo antes de cada petición; verificar con un test de `tests/core/` que el prompt cambia entre pasos cuando se carga un archivo.
- [ ] 2.2 Devolver las rutas en `ResultadoDespacho` y avisar al runner después de cada herramienta; verificar que dos rutas de la misma carpeta cargan una sola vez.
- [ ] 2.3 Recomponer el prompt en el runner con el orden raíz, ancestros y agente; verificar los escenarios de dos y tres niveles.
- [ ] 2.4 Mantener el registro fuera del historial para que sobreviva a la compactación; verificar el escenario de recarga después de compactar.

## 3. Topes y errores

- [ ] 3.1 Agregar el tope total configurable de 64 KiB junto al tope por archivo de 32 KiB; verificar el escenario de total dentro del tope.
- [ ] 3.2 Devolver como texto el error de tope a mitad de turno sin inyectar el archivo y sin cortar el turno; verificar los dos escenarios de exceso.
- [ ] 3.3 Emitir el evento de carga con ruta, tamaño y tokens, y sumarlo a `tokensSistema`; verificar que el panel de contexto lo refleja.

## 4. Subagentes e interfaz

- [ ] 4.1 Pasar al subagente el conjunto de instrucciones vigente del padre al lanzarlo, sin registro propio; verificar que no carga anidados por su cuenta.
- [ ] 4.2 Mostrar el aviso de carga en la TUI y en el renderizador de línea a línea; verificar que el aviso aparece con la ruta.

## 5. Cierre

- [ ] 5.1 Actualizar `AGENTS.md`, `openspec/config.yaml`, `docs/comportamiento.md`, `PREGUNTAS.md` y `alcance/nivel-8-memoria.md`; verificar que las cifras coinciden con los specs.
- [ ] 5.2 Ejecutar `npm run check` y `openspec validate --all`; verificar que ambos terminan en verde.
- [ ] 5.3 Archivar en orden: `260-instrucciones-proyecto` antes que este change; verificar que `openspec archive 280-agentes-anidados` no se queja de la capacidad faltante.
