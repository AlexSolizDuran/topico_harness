# Nivel 1 — El loop

**Eje:** capacidad
**Esfuerzo:** días
**Depende de:** [Nivel 0](nivel-0-one-shot.md)

Acá aparece el harness de verdad. Si este nivel está bien, ya tenés algo usable.

## Qué resuelve

El Nivel 0 no puede hacer nada. El modelo no lee archivos, no corre comandos, no
se corrige. Este nivel le da esas tres cosas.

## Un ejemplo real

Pedile: *"agregá un test para la función de división en utils.ts"*. Esto es lo
que pasa:

```
Usuario: "agregá un test para la división"
  │
  ▼
LLM → "Voy a revisar el archivo."  + tool_call(read, utils.ts)
  │
  ▼  harness ejecuta read, mete el contenido como resultado
  │
LLM → tool_call(grep, "divid")
  │
  ▼  harness ejecuta, devuelve 3 líneas
  │
LLM → tool_call(read, test/utils.test.ts)
  │
  ▼
LLM → tool_call(edit, agregar el test)
  │
  ▼
LLM → tool_call(bash, "npm test")
  │
  ▼  harness ejecuta, el test FALLA, devuelve el error
  │
LLM → "El import está mal." + tool_call(edit, corregir)
  │
  ▼
LLM → tool_call(bash, "npm test") →  pasa
  │
  ▼
LLM → "Listo. Agregué el test en test/utils.test.ts, línea 24."
```

**~8 viajes de ida y vuelta** para una tarea simple. Cada uno es una llamada
completa a la API: con latencia y con costo.

Ese es el motivo por el que el diseño importa. Si el harness es lento, cada
tarea cuesta 8 esperas. Si el contexto está mal gestionado, cada viaje manda la
conversación entera y el costo se dispara.

## Las 7 piezas

| # | Pieza | Qué resuelve |
|---|---|---|
| 1 | **Historial** | Los mensajes se acumulan: user, assistant, tool, assistant… |
| 2 | **Streaming** | Los eventos del provider se consumen y se traducen |
| 3 | **Despacho** | `tool_call` → buscar la tool correcta en el registro |
| 4 | **Validación** | Los args llegan como string; los validás contra el schema |
| 5 | **Ejecución** | Correr la tool, capturar stdout, stderr y excepción |
| 6 | **Límite de pasos** | Cortar a los N viajes |
| 7 | **Cancelación** | `Ctrl+C` → `AbortController` sobre el fetch |

### 1. Historial

El modelo no recuerda. Cada viaje le mandás **todo** lo que pasó:

```ts
[
  { rol: 'user',      contenido: 'agregá un test para la división' },
  { rol: 'assistant', tool_calls: [{ nombre: 'read', args: {...} }] },
  { rol: 'tool',      resultado: '<contenido del archivo>' },
  { rol: 'assistant', contenido: '...' },
]
```

El orden importa y es estricto. Un `tool` **siempre** sigue a su `assistant` con
tool call. Si lo rompés, el provider rechaza la request entera.

### 2. Streaming

Traducir los eventos del provider a eventos internos. El provider te da cosas
como texto incremental, tool call completa, fin. Vos exponés tus propios tipos.

El error clásico: usar los eventos del provider como API interna. Después no
podés cambiar de provider. **Traducí siempre**, aunque haya un solo provider.

### 3. Despacho

Un registro de tools, del tipo `nombre → { schema, ejecutar }`.

El orden importa para el Nivel 5: el registro tiene que ser **datos**, no un
`switch` en el loop. Si es un switch, los permisos no se pueden colgar de ahí.

### 4. Validación

Los args del modelo llegan como **string JSON**, a veces truncado si cortaste el
stream, a veces con campos inventados.

```ts
const args = JSON.parse(argsRaw);
const parseado = schemaTool.safeParse(args);
if (!parseado.success) {
  return `ERROR: argumentos inválidos en ${nombreTool}. Esperaba: ...`;
}
```

Ese `return` con el error es lo que permite que el modelo se corrija. Tirar la
excepción lo mata.

### 5. Errores: la pieza que más se subestima

**Un error nunca se tira. Se convierte en texto y vuelve al modelo.**

```ts
try {
  return await ejecutar(tool, args);
} catch (e) {
  return `ERROR: ${e.message}\nLa operación no se completó.`;
}
```

Por qué importa: si tirás, el proceso muere. Si lo volvés como texto, el modelo
lo lee y **se corrige solo**.

El caso real de arriba: el agente corre `npm test`, falla por un import mal
escrito, el error vuelve como texto, y en el siguiente paso arregla el import.
Sin esto, hay que reiniciar a mano.

Hay un matiz de seguridad: el mensaje de error no debe filtrar la key ni rutas
sensibles. Truncá a un largo razonable.

### 6. Límite de pasos

Sin tope, un modelo que se equivoca pide la misma tool en bucle hasta llenar la
ventana de contexto y morir de timeout.

El tope corta **y devuelve el estado al modelo**, no solo corta:

```
"Superaste el límite de 25 pasos. El estado actual es: modificaste utils.ts 
pero el test sigue fallando."
```

### 7. Cancelación

```
Ctrl+C  →  AbortController.abort()  →  fetch cortado  →  estado consistente
```

Tres estados que deben quedar bien:

| Estado | Qué muestra | Qué guarda |
|---|---|---|
| `completado` | El modelo terminó sin pedir más tools | Sí, como completo |
| `cancelado` | El turno paró a medias | Sí, pero marcado cancelado |
| `fallido` | El provider tiró | Sí, con el error |

**El error clásico:** `Ctrl+C` corta el output pero deja el fetch vivo. La UI
dice "parado" mientras la API sigue cobrando tokens. La cancelación tiene que
bajar al `fetch`, no solo a la impresión.

## Equivalente en OpenCode

| Pieza | En OpenCode |
|---|---|
| Historial | `messages`, con roles `user` / `assistant` / `tool` |
| Streaming | Eventos del provider traducidos a partes de UI message |
| Despacho | Registro de tools con nombres fijos |
| Validación | Schemas tipados por tool |
| Errores | Tool errors vuelven como parte `tool-error` del stream |
| Límite de pasos | `steps` en la config del agente; en el último paso **quita las tools** y pide un resumen en texto |
| Cancelación | `AbortController` compartido; ESC en la TUI |

El detalle de `steps` vale copiarlo: OpenCode no corta en seco. En el último
paso **remueve las tools del schema** y le pide al modelo que resuma. Obliga al
modelo a cerrar el trabajo en lugar de dejarlo colgado.

Las tools de OpenCode son `bash`, `edit`, `write`, `read`, `grep`, `glob`,
`lsp`, `apply_patch`, `skill`, `webfetch`, `websearch`, `question`. `edit`,
`write` y `apply_patch` comparten **un solo** permiso, llamado `edit`. Esa
agrupación es buena: el permiso es por **efecto** (modificar archivos), no por
mecanismo.

## "Funciona" si

> *"Agregá un test para la función de división"* completa la tarea: lee, edita,
> corre el test, ve el fallo, se corrige, vuelve a pasar, y reporta. `Ctrl+C` lo
> frena en cualquier punto.

Eso es un harness. Ahí ya tenés algo.

## Trampas

| Trampa | Síntoma |
|---|---|
| Errores que se tiran | El proceso muere a mitad de tarea |
| `Ctrl+C` que no corta el fetch | Cobrás tokens que no mostraste |
| Sin límite de pasos | Loop infinito hasta timeout |
| Args sin validar | El modelo manda basura, la tool explota |
| Contenido del tool sin truncar | Un `cat` de 50KB te llena la ventana |
| Eventos del provider como API interna | No podés cambiar de provider después |
| Registro de tools como `switch` | Nivel 5 imposible sin reescribir |
| Colgar entre assistant y su tool | El provider rechaza toda la request |

## Qué NO entra

Persistencia (si cerrás, se pierde), compactación, aprobaciones, subagentes,
memoria.

## El criterio de terminado

No es "anda". Es:

1. Una tarea multi-paso completa de punta a punta
2. Un error de una tool se recupera **sin intervención humana**
3. `Ctrl+C` en cualquier punto deja el estado consistente y **no cobra** tokens
4. Un bucle estúpido corta por límite de pasos y lo dice