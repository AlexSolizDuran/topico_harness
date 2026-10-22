# Proposal

## Why

Hoy la única barrera es la lista de herramientas del agente: si el agente declara
`write`, escribe. No hay forma de decir "preguntame antes de tocar este archivo" ni
"este comando nunca". Y la lista negra de comandos es código, no configuración: no
se ajusta sin recompilar.

El harness necesita un gate entre "el modelo pidió" y "la herramienta ejecutó", con
reglas que se editen como datos. Sin ese gate, cada herramienta nueva tiene que
inventar su propia política y no hay un lugar único donde auditar qué puede pasar.

## What Changes

- Reglas de permiso como lista ordenada de acción, recurso y efecto, con la última
  coincidencia ganando.
- Acciones por lo que hace la herramienta, no por su nombre: editar cubre escribir
  y editar; ejecutar cubre el shell; delegar cubre el subagente.
- Política base que permite, consulta los archivos de entorno y permite sus
  plantillas.
- Reglas por agente agregadas al final de las globales.
- Gate en el turno: permitir ejecuta, denegar devuelve el rechazo como texto,
  consultar espera la decisión sin cortar el turno.
- Aprobación con tres salidas: una vez, siempre y denegar. Siempre guarda una regla
  del proyecto con el patrón propuesto; nunca pisa una denegación configurada.
- Sin terminal interactiva, la aprobación se deniega.
- La herramienta de ejecución pasa a llamarse `shell` en todas las plataformas.

## Capabilities

### New Capabilities

- `permissions`: reglas, patrones, acciones, política base, merge por agente y
  aprobaciones.

### Modified Capabilities

- `core`: el despacho consulta el permiso y espera la decisión; cancelar la espera
  cancela el turno; el historial no se parte.
- `interface`: la barra muestra la espera y aparece el panel de aprobación.
- `tools`: cada herramienta declara su acción y su recurso; la ejecución se llama
  `shell` en las tres plataformas.

## Impact

- `openspec/specs/permissions/spec.md` (nuevo).
- `src/permissions/` (nuevo): reglas, evaluación, merge y aprobaciones guardadas.
- `src/core/registry.ts` y `src/core/turn.ts`: acción y recurso en cada herramienta;
  el despacho espera la decisión.
- `src/tools/shell.ts`: nombre `shell` en todas las plataformas.
- `src/interface/`: panel de aprobación y estado de espera.
- `src/app.ts` y `src/args.ts`: composición del gate.
- `tests/permissions/` y los tests de los deltas.

## Dependencia

Se apoya en `150-agentes` para el merge por agente y en `160-subagentes` para el
permiso de delegar. El delta de `interface` modifica el estado de la sesión que
`150` ya amplió: al archivar, el orden es `150`, `160`, `170`.
