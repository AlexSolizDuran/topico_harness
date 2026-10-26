# Design

## Almacenamiento

Cada sesión vive en `.harness/sesiones/<id>/`, dentro del proyecto:

```
sesion.json    metadatos
eventos.jsonl  registros, uno por línea
```

`sesion.json`:

```json
{
  "id": "20261026-143012-a1b2",
  "creadaEn": "2026-10-26T14:30:12.000Z",
  "actualizadaEn": "2026-10-26T14:41:03.000Z",
  "directorio": "/ruta/al/proyecto",
  "modelo": "openrouter/openai/gpt-4o",
  "agente": "build",
  "padre": "20261025-090000-ff00",
  "desdeTurno": 4
}
```

Registros:

```json
{"tipo":"turno","estado":"completado","mensajes":[...]}
{"tipo":"compactacion","mensajes":[...]}
```

Una línea por turno, no por mensaje. La razón es la atomicidad: si el proceso muere
a mitad de escritura, la última línea queda incompleta y se descarta entera. Con una
línea por mensaje quedaría medio turno guardado y habría que reconstruir qué parte
era válida.

## Reproducción

Al cargar:

1. Se leen las líneas no vacías en orden.
2. `turno` concatena mensajes; `compactacion` reemplaza el historial acumulado.
3. Si la última línea no parsea o no valida, se ignora.
4. Si una línea anterior falla, la carga devuelve error: no se pierde nada en
   silencio.

La validación de un registro es estructural: `tipo` conocido, `mensajes` es un
arreglo y cada mensaje tiene un rol conocido.

## Puntos de guardado

La persistencia vive en `SesionInteractiva`, no en el núcleo. `src/core/` no sabe
que existe un archivo.

- Al cerrar un turno, se guarda la diferencia entre el historial anterior y
  `estadoFinal.mensajes`.
- Si hubo compactación, después se agrega el registro de reemplazo con el historial
  vigente.
- Si el proceso muere antes de cerrar el turno, no se guarda nada de ese turno.
- `cambiarModelo` y `cambiarAgente` actualizan `sesion.json` con escritura atómica
  (archivo temporal + rename).

## Credenciales

Antes de serializar, `sanearMensajes` recorre el mensaje y aplica `sanitizarTexto`
a cada cadena: contenido, resultados, argumentos y valores anidados. La credencial
configurada nunca llega al disco. Los archivos se crean con modo `0600` y el
directorio con `0700`.

## Reanudar

- `--continuar`: última sesión del proyecto por `actualizadaEn`.
- `--sesion <id>`: sesión concreta; un id inválido termina con código 1 y mensaje.
- En la TUI: `/sesiones` lista, `/sesiones <id>` carga, `/nueva` crea.
- Al cargar se reconstruye el historial visual desde los mensajes: usuario,
  asistente, tarjetas de herramienta y delegaciones. Es presentación, vive en
  `interface/state.ts`.
- El modelo restaurado se resuelve con la fábrica de proveedores; si el modelo ya no
  está configurado, la sesión avisa y conserva el historial.

## Límite y poda

`sesiones.maximo` (por defecto 50) se aplica al crear una sesión. Se listan las
sesiones del proyecto, se ordenan por antigüedad y se eliminan las sobrantes sin
tocar la activa. La poda es best-effort: un fallo al borrar no impide crear la
sesión nueva.

## Configuración

`.harness/config.json` admite:

```json
{ "sesiones": { "guardar": true, "maximo": 50 } }
```

`guardar: false` desactiva todo. `--sin-sesion` gana sobre la configuración.

## Alternativas descartadas

- **Un JSON completo por sesión**: un corte de escritura pierde la sesión entera.
- **Una línea por mensaje**: un corte deja medio turno y obliga a reconstruirlo.
- **SQLite**: un día de setup para una necesidad que el archivo de solo agregado
  cubre.
- **Bloqueo entre procesos**: un proceso por proyecto es la regla actual; se
  documenta, no se implementa.

## Pruebas

Un test por escenario. Los tests de almacén usan un directorio temporal y un reloj
inyectado para que los identificadores y las fechas sean deterministas. Los tests
de interfaz usan un proveedor simulado y verifican comandos y restauración del
historial visual.
