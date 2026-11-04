# Design: Recordatorios, Prefijo Estable y Cola de Shell

## 1. Recordatorios de Sistema (`src/context/reminders.ts`)

- Gestor de recordatorios con estado por turno/sesión:
  - `objetivoOriginal`: string preservado fuera del historial de mensajes (en el estado del turno o runner).
  - `pasosSinEscritura`: contador incremental que se resetea al ocurrir una herramienta de escritura/edición (`write`, `edit`, `apply_patch`).
  - `ultimoRecordatorioInyectado`: tipo o firma del último recordatorio para evitar inyecciones consecutivas idénticas o duplicadas en el mismo turno.
  - Tipos de recordatorio:
    - Post-edición: sugerencia de verificar el cambio con pruebas o lectura.
    - Inactividad de escritura: tras N pasos (por defecto 5) sin modificar archivos, reinyecta el objetivo original.
    - Post-compactación: informa que el historial fue resumido y que el objetivo original sigue vigente.
  - Reglas de inserción:
    - Se inyecta con rol `'system'`.
    - Nunca se inserta entre un mensaje con `tool_calls` y los correspondientes mensajes `tool`. Siempre se inserta antes de llamar al provider o después de cerrar la tanda de herramientas.
    - Si el turno compactó al final del turno anterior, se genera el recordatorio de post-compactación al iniciar el siguiente turno.

## 2. Prefijo Estable (`src/provider/` & `src/core/turn.ts`)

- Orden determinista de herramientas:
  - En la preparación de la petición al provider, la lista de definiciones de herramientas se ordena de manera estable (por nombre/identificador), de modo que los cambios dinámicos de permisos o llamadas intermedias no alteren el array de `tools`.
- Inmutabilidad del prompt de sistema:
  - El prompt de sistema se fija al iniciar el turno y no se modifica durante los pasos del turno.
- Historial acumulativo:
  - Solo por adición dentro de un turno. La compactación ocurre únicamente al final del turno, de modo que el prefijo de mensajes permanece idéntico en las llamadas intermedias del mismo turno, permitiendo el aprovechamiento de prompt caching en los providers que lo soportan.

## 3. Cola de Ejecución de Shell (`src/tools/shell.ts`)

- Truncado tipo cola (`tail`):
  - Cuando la salida de `shell` (stdout o stderr) excede el límite (ej. 50_000 caracteres o configurable):
    - Se extraen los últimos `limite` caracteres.
    - Se antepone el marcador:
      `[... ${omitidos} caracteres omitidos. La salida completa está disponible en la interfaz ...]\n`
    - Si el comando falló (exit code != 0), la cola conserva el final del error.
    - Cada comando genera su propia cola independiente (no se mezclan salidas entre comandos concurrentes o sucesivos).
    - La herramienta devuelve la cola al modelo en el resultado de texto, pero incluye o emite metadatos con la salida completa.

## 4. Preservación de Salida Completa en la Interfaz (`src/interface/`)

- En `ResultadoEjecucionHerramienta` o en el evento de herramienta terminada, se transporta la `salidaCompleta` además del texto entregado al modelo.
- El estado visual (`historial`) registra `salidaCompleta` en los items de tipo herramienta / ejecución.
- La vista de la TUI distingue si la salida fue recortada y conserva la salida íntegra accesible en la sesión aun después de terminar el turno.
