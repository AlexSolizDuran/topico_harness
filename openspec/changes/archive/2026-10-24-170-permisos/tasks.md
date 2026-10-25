# Tasks

## 1. Reglas y evaluación

- [x] 1.1 Definir el tipo de regla `{ acción, recurso, efecto }` y el tipo de efecto `permitir | consultar | denegar`.
- [x] 1.2 Leer las reglas desde el archivo de configuración del proyecto, en orden.
- [x] 1.3 Implementar el comparador de patrones: `*` cruza `/`, `?` un carácter, resto literal.
- [x] 1.4 Normalizar las rutas antes de comparar (separadores y `.`/`..`).
- [x] 1.5 Hacer que un patrón de comando terminado en espacio y `*` coincida también sin argumentos.
- [x] 1.6 Implementar la evaluación: última coincidencia gana; sin coincidencia, consultar.
- [x] 1.7 Definir las acciones leer, buscar archivos, buscar texto, editar, ejecutar, delegar y directorio externo.
- [x] 1.8 Resolver varios recursos en una operación: cualquier `denegar` deniega; si no, cualquier `consultar` consulta.

## 2. Política base y merge por agente

- [x] 2.1 Aplicar la base: permitir todo, consultar `read *.env` y `read *.env.*`, permitir `read *.env.example`.
- [x] 2.2 Permitir por defecto las rutas fuera del proyecto y evaluarlas contra directorio externo antes que leer o editar.
- [x] 2.3 Concatenar las reglas del agente al final de las globales, sin reemplazar.
- [x] 2.4 Usar las reglas propias del subagente en su turno, no las del padre.
- [x] 2.5 Verificar que una regla nueva en el archivo se aplica sin tocar el código.

## 3. Gate en el turno

- [x] 3.1 Declarar en cada herramienta su acción de permiso y cómo extraer el recurso de sus argumentos.
- [x] 3.2 No habilitar una herramienta que no declare acción y recurso.
- [x] 3.3 Inyectar el evaluador de permisos al núcleo por parámetro, sin que `core/` importe `permissions/`.
- [x] 3.4 Consultar el permiso en el despacho antes de ejecutar.
- [x] 3.5 Con `permitir`, ejecutar; con `denegar`, no ejecutar y devolver el rechazo como texto.
- [x] 3.6 Con `consultar`, esperar la decisión sin ejecutar.
- [x] 3.7 Mantener el turno en curso durante la espera y cancelarla si se cancela el turno.
- [x] 3.8 No agregar al historial un resultado sin su llamada.
- [x] 3.9 Devolver un rechazo como resultado y dejar que el turno continúe.
- [x] 3.10 Sin gate inyectado, ejecutar como hoy (compatibilidad con los llamadores actuales).

## 4. Aprobaciones

- [x] 4.1 Modelar la solicitud con acción, recurso y patrón propuesto por la herramienta.
- [x] 4.2 Implementar aprobar una vez: ejecuta esa solicitud y la siguiente vuelve a consultar.
- [x] 4.3 Implementar aprobar siempre: guarda una regla de permitir con el patrón propuesto.
- [x] 4.4 Implementar denegar: rechaza la solicitud y las demás pendientes de la sesión.
- [x] 4.5 Nunca pisar una denegación configurada con una aprobación guardada.
- [x] 4.6 Guardar las aprobaciones de forma durable y con alcance de proyecto en un archivo ignorado por git.
- [x] 4.7 Resolver como denegación una aprobación pendiente sin cliente interactivo, informando acción y recurso.

## 5. Interfaz

- [x] 5.1 Mostrar en la barra de estado que el turno espera una aprobación.
- [x] 5.2 Mostrar el panel con la acción, el recurso y las tres opciones.
- [x] 5.3 Cablear las teclas de aprobar una vez, aprobar siempre y denegar.
- [x] 5.4 No ejecutar la herramienta ni asumir una decisión desde la interfaz.
- [x] 5.5 Sin terminal interactiva, denegar y explicar el motivo.

## 6. `shell` y metadatos de herramienta

- [x] 6.1 Cambiar el nombre de la herramienta de ejecución a `shell` en todas las plataformas.
- [x] 6.2 Mantener la elección de intérprete y catálogo por plataforma; actualizar la descripción.
- [x] 6.3 Actualizar el assert del nombre en `tests/tools/tools.test.ts`.
- [x] 6.4 Declarar acción y recurso en leer, buscar archivos, buscar texto, escribir, editar, ejecutar y delegar.

## 7. Tests

- [x] 7.1 Un test por cada escenario de `openspec/specs/permissions/spec.md`.
- [x] 7.2 Tests de los escenarios nuevos de los deltas de `core`, `interface` y `tools`.
- [x] 7.3 Test de que `core/` no importa `permissions/` ni `interface/`.
- [x] 7.4 Test de que una aprobación guardada no anula una denegación configurada.
- [x] 7.5 Test de que sin terminal interactiva la aprobación se deniega.
- [x] 7.6 Correr `npm run check` en verde.

## 8. Cierre

- [x] 8.1 Verificar que el orden de archivo sea `150`, `160`, `170`.
- [x] 8.2 Actualizar los conteos de `AGENTS.md` y `openspec/config.yaml` al archivar.
- [x] 8.3 Marcar como resuelta en `PREGUNTAS.md` la pregunta sobre `write`/`edit` en el gate.
