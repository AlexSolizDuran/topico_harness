# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- El 260 deja la carga en un solo punto: `construirHarness` lee la raíz y compone
  `promptSistemaBase`. `SesionInteractiva` lo combina con el prompt del agente.
- `ejecutarTurno` recibe `sistema?: string` y lo usa en **cada paso** del loop. No
  hay forma de que cambie a mitad de turno.
- `EntradaHerramienta.ejecutar` devuelve un `string`; las tools no informan qué
  rutas tocaron.
- `recortarSalidasHerramientasViejas` y `compactarHistorial` reemplazan el
  historial; cualquier registro que viva dentro de los mensajes se pierde.
- El presupuesto ya expone `tokensSistema` desde el 260.

## Goals / Non-Goals

**Goals:**

- Que las instrucciones de una carpeta lleguen **antes** de la primera acción
  sobre esa carpeta, no al turno siguiente.
- Que el registro de cargados sea explícito y sobreviva a la compactación.
- Que el tope total falle temprano y con un mensaje accionable.

**Non-Goals:**

- Recarga en caliente al editar un `AGENTS.md`.
- Instrucciones de directorios fuera del proyecto.
- Detección de rutas dentro de `shell`.
- Carga propia en subagentes.

## Decisions

**El prompt se recompone por paso.** `ejecutarTurno` acepta
`sistema?: string | (() => string)` y lo resuelve antes de cada petición. Un string
se comporta como hoy; una función permite que el runner devuelva el prompt vigente.
Alternativa descartada: cargar en el límite del turno, que es más barato pero llega
tarde — el agente edita `packages/web` sin sus convenciones y las recibe cuando ya
no sirven.

**Las rutas se declaran en el registro, no en las tools.** `EntradaHerramienta`
suma `rutasExploradas?: (argumentos) => string[]` y `dispatch` las devuelve en su
resultado. No cambia la firma de `ejecutar`, así que las once tools y sus tests
quedan intactos. Alternativa descartada: devolver `{ texto, rutas }` desde cada
tool, que obliga a tocar todas.

**Solo cuentan las rutas concretas.** `read`, `write`, `edit` y `patch` declaran
sus rutas (el parche las extrae de sus encabezados `*** Update File:` y
equivalentes). `glob` aporta el prefijo de directorio de su patrón, y solo si lo
tiene. `grep` busca en todo el proyecto y `shell` ejecuta comandos: ninguno de los
dos declara rutas. Alternativa descartada: disparar con todo, que haría que un
`grep` cargue todos los `AGENTS.md` del repo de una vez y destruya la carga
perezosa.

**El registro de cargados vive en la sesión, no en el historial.** Es un `Set` de
rutas reales resueltas, propiedad del runner. Así una compactación no lo borra y no
hay recarga. Alternativa descartada: marcar los mensajes, que se pierden al
resumir.

**Orden raíz → hoja.** El prompt se arma recorriendo las instrucciones cargadas de
menos a más profunda, y el prompt del agente va al final. Lo específico gana sobre
lo general, igual que en el 260.

**Tope total de 64 KiB, con error como texto a mitad de turno.** El tope por
archivo (32 KiB) no evita diez archivos de 20 KiB. 64 KiB son ~16.000 tokens, el
16% de un presupuesto de 102.400. A mitad de turno ya hay trabajo hecho: tirar la
excepción perdería el turno por un archivo que el agente no pidió. Alternativa
descartada: matar la sesión, coherente con el arranque pero destructivo acá.

**Los subagentes heredan y no cargan.** Al lanzarse reciben el conjunto vigente del
padre. Su exploración es de solo lectura y su contexto es aislado; cargar más ahí
multiplica el costo sin cambiar lo que reportan. Alternativa descartada: registro
propio por subagente, más correcto pero más caro y más difícil de reproducir.

**La recomposición invalida el caché una vez por archivo.** Cuando entra un archivo
nuevo, el prefijo del prompt cambia y esa petición paga entrada completa. Es
acotado: como máximo una vez por archivo cargado en la sesión.

## Risks / Trade-offs

- [Un `AGENTS.md` anidado cambia el prompt a mitad de turno] → El cambio es visible en la interfaz y el archivo se carga una sola vez.
- [El registro en memoria se pierde si se reanuda la sesión] → Al reanudar se vuelve a cargar la raíz y los anidados entran de nuevo al explorar; el costo es una invalidación de caché, no un error.
- [Un `glob` con prefijo amplio carga una carpeta que el agente no usa] → Es el mismo comportamiento que OpenCode y el tope total lo acota.
- [El parseo de rutas del parche puede fallar] → Si no se reconocen encabezados, no se declara ninguna ruta: se pierde la carga, no se carga de más.

## Migration Plan

No hay migración. Un proyecto con un solo `AGENTS.md` en la raíz se comporta igual
que con el 260. Para desactivar la carga anidada alcanza con no tener `AGENTS.md`
en las subcarpetas.

## Archive Order

Este delta **modifica** un requisito de `instructions`, que recién existe cuando se
archiva `260-instrucciones-proyecto`. `openspec archive` rechaza el change mientras
la capacidad no exista: hay que archivar el 260 antes.
