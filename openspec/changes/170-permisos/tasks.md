# Tasks

## 1. Reglas y evaluación

- [ ] 1.1 Definir el tipo de regla `{ acción, recurso, efecto }` y el tipo de efecto `permitir | consultar | denegar`.
- [ ] 1.2 Leer las reglas desde el archivo de configuración del proyecto, en orden.
- [ ] 1.3 Implementar el comparador de patrones: `*` cruza `/`, `?` un carácter, resto literal.
- [ ] 1.4 Normalizar las rutas antes de comparar (separadores y `.`/`..`).
- [ ] 1.5 Hacer que un patrón de comando terminado en espacio y `*` coincida también sin argumentos.
- [ ] 1.6 Implementar la evaluación: última coincidencia gana; sin coincidencia, consultar.
- [ ] 1.7 Definir las acciones leer, buscar archivos, buscar texto, editar, ejecutar, delegar y directorio externo.
- [ ] 1.8 Resolver varios recursos en una operación: cualquier `denegar` deniega; si no, cualquier `consultar` consulta.

## 2. Política base y merge por agente

- [ ] 2.1 Aplicar la base: permitir todo, consultar `read *.env` y `read *.env.*`, permitir `read *.env.example`.
- [ ] 2.2 Permitir por defecto las rutas fuera del proyecto y evaluarlas contra directorio externo antes que leer o editar.
- [ ] 2.3 Concatenar las reglas del agente al final de las globales, sin reemplazar.
- [ ] 2.4 Usar las reglas propias del subagente en su turno, no las del padre.
- [ ] 2.5 Verificar que una regla nueva en el archivo se aplica sin tocar el código.

## 3. Gate en el turno

- [ ] 3.1 Declarar en cada herramienta su acción de permiso y cómo extraer el recurso de sus argumentos.
- [ ] 3.2 No habilitar una herramienta que no declare acción y recurso.
- [ ] 3.3 Inyectar el evaluador de permisos al núcleo por parámetro, sin que `core/` importe `permissions/`.
- [ ] 3.4 Consultar el permiso en el despacho antes de ejecutar.
- [ ] 3.5 Con `permitir`, ejecutar; con `denegar`, no ejecutar y devolver el rechazo como texto.
- [ ] 3.6 Con `consultar`, esperar la decisión sin ejecutar.
- [ ] 3.7 Mantener el turno en curso durante la espera y cancelarla si se cancela el turno.
- [ ] 3.8 No agregar al historial un resultado sin su llamada.
- [ ] 3.9 Devolver un rechazo como resultado y dejar que el turno continúe.
- [ ] 3.10 Sin gate inyectado, ejecutar como hoy (compatibilidad con los llamadores actuales).

## 4. Aprobaciones

- [ ] 4.1 Modelar la solicitud con acción, recurso y patrón propuesto por la herramienta.
- [ ] 4.2 Implementar aprobar una vez: ejecuta esa solicitud y la siguiente vuelve a consultar.
- [ ] 4.3 Implementar aprobar siempre: guarda una regla de permitir con el patrón propuesto.
- [ ] 4.4 Implementar denegar: rechaza la solicitud y las demás pendientes de la sesión.
- [ ] 4.5 Nunca pisar una denegación configurada con una aprobación guardada.
- [ ] 4.6 Guardar las aprobaciones de forma durable y con alcance de proyecto en un archivo ignorado por git.
- [ ] 4.7 Resolver como denegación una aprobación pendiente sin cliente interactivo, informando acción y recurso.

## 5. Interfaz

- [ ] 5.1 Mostrar en la barra de estado que el turno espera una aprobación.
- [ ] 5.2 Mostrar el panel con la acción, el recurso y las tres opciones.
- [ ] 5.3 Cablear las teclas de aprobar una vez, aprobar siempre y denegar.
- [ ] 5.4 No ejecutar la herramienta ni asumir una decisión desde la interfaz.
- [ ] 5.5 Sin terminal interactiva, denegar y explicar el motivo.

## 6. `shell` y metadatos de herramienta

- [ ] 6.1 Cambiar el nombre de la herramienta de ejecución a `shell` en todas las plataformas.
- [ ] 6.2 Mantener la elección de intérprete y catálogo por plataforma; actualizar la descripción.
- [ ] 6.3 Actualizar el assert del nombre en `tests/tools/tools.test.ts`.
- [ ] 6.4 Declarar acción y recurso en leer, buscar archivos, buscar texto, escribir, editar, ejecutar y delegar.

## 7. Tests

- [ ] 7.1 Un test por cada escenario de `openspec/specs/permissions/spec.md`.
- [ ] 7.2 Tests de los escenarios nuevos de los deltas de `core`, `interface` y `tools`.
- [ ] 7.3 Test de que `core/` no importa `permissions/` ni `interface/`.
- [ ] 7.4 Test de que una aprobación guardada no anula una denegación configurada.
- [ ] 7.5 Test de que sin terminal interactiva la aprobación se deniega.
- [ ] 7.6 Correr `npm run check` en verde.

## 8. Cierre

- [ ] 8.1 Verificar que el orden de archivo sea `150`, `160`, `170`.
- [ ] 8.2 Actualizar los conteos de `AGENTS.md` y `openspec/config.yaml` al archivar.
- [ ] 8.3 Marcar como resuelta en `PREGUNTAS.md` la pregunta sobre `write`/`edit` en el gate.
