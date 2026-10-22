# Design

## Context

Ver `proposal.md` — Why. La interfaz `Proveedor` y los eventos internos ya
existen en `src/provider/types.ts` y `src/types.ts`. `ejecutarConReintentos` ya
clasifica 429, 5xx, `ECONNRESET` y `ETIMEDOUT`. `obtenerCredencial` y
`sanitizarTexto` ya resuelven el secreto. No hay código HTTP.

## Goals / Non-Goals

**Goals:**

- Un adaptador que cubra cualquier API compatible con OpenAI.
- Configurar un modelo nuevo sin tocar código.
- Que el segundo adaptador sea un archivo nuevo y una entrada en la factory.

**Non-Goals:**

- Anthropic, Gemini y Bedrock. Quedan como adaptadores futuros.
- Cambiar de modelo en caliente (llega en `100-modelo-caliente`).
- Fallback automático entre proveedores.
- Persistir conversaciones.

## Decisions

### `fetch` nativo, sin SDK

Node 24 trae `fetch` y `ReadableStream`. Un SDK agrega dependencia, versión y su
propio manejo de errores, y el contrato necesita traducir igual. Alternativa
descartada: SDK oficial de OpenAI, que acopla el adaptador a un proveedor aunque
la API sea compatible.

### Parser SSE propio en `src/provider/sse.ts`

Se parsea línea a línea el cuerpo del stream, acumulando `data:` hasta la línea
en blanco. Se expone como `AsyncGenerator<string>` de payloads. Anthropic y
Gemini usan el mismo transporte, así que el parser se reutiliza.

### Traducción de mensajes

| Interno | OpenAI |
|---|---|
| `sistema` | `messages[0] = { role: 'system', content }` |
| `rol: 'user'` | `{ role: 'user', content }` |
| `assistant` con `llamadasHerramientas` | `{ role: 'assistant', content, tool_calls: [{ id, type: 'function', function: { name, arguments } }] }` |
| `rol: 'tool'` con `idLlamada` | `{ role: 'tool', tool_call_id, content: resultado }` |
| `herramientas` | `tools: [{ type: 'function', function: { name, description, parameters } }]` |

Los argumentos de las tool calls se serializan con `JSON.stringify` al enviar y
se dejan como string al recibir; `dispatch.ts` ya sabe parsear strings JSON.

### Tool calls fragmentadas

El stream entrega `delta.tool_calls[]` con `index`. Se acumula por índice:
`id`, `name` y `arguments` se concatenan. Al llegar `finish_reason: 'tool_calls'`
se emite una `solicitud_herramienta` por cada índice completo. Alternativa
descartada: emitir en cada delta, que produciría solicitudes incompletas.

### Errores y reintentos

Todo fallo HTTP se convierte en `ErrorProveedor` con `codigoEstado` y
`esTransitorio` calculado igual que `esErrorTransitorio` (429 y 5xx). Las
llamadas pasan por `ejecutarConReintentos` con `dormir` inyectable. Un 400 o 401
no se reintenta y llega al turno como `fallido`.

### Configuración

Dos archivos, el segundo pisa al primero:

1. `~/.config/harness/config.json` (o `%APPDATA%\harness\config.json` en Windows).
2. `.harness/config.json` en el directorio del proyecto.

```json
{
  "proveedorPorDefecto": "deepseek",
  "modeloPorDefecto": "deepseek-chat",
  "proveedores": {
    "deepseek": {
      "tipo": "openai-compatible",
      "baseUrl": "https://api.deepseek.com/v1",
      "variableApiKey": "DEEPSEEK_API_KEY",
      "modelos": [
        { "id": "deepseek-chat", "soportaHerramientas": true, "ventanaContexto": 128000 }
      ]
    }
  }
}
```

La key nunca vive en el archivo: `variableApiKey` es el nombre de la variable.
Si el proveedor no la necesita (Ollama local), se omite y el adaptador no manda
header de auth.

### Capacidades del modelo

- `soportaHerramientas: false` → no se envía `tools` y el modelo no puede actuar.
- `ventanaContexto` → la consume el presupuesto de contexto en `090`.
- Sin streaming: el adaptador emite un único `texto` con todo el contenido.

### Suite de contrato

`tests/provider/contract.test.ts` expone `verificarContratoProveedor(nombre,
crearProveedor)` y corre la misma batería contra un servidor HTTP local que
devuelve SSE guionado. Cada adaptador futuro agrega una línea y hereda los tests.
Alternativa descartada: un test por proveedor duplicado, que se desincroniza.

## Risks / Trade-offs

- [Las APIs compatibles no lo son tanto: difieren en roles, campos y streaming] →
  el adaptador tolera campos desconocidos y documenta las diferencias conocidas;
  si una API diverge demasiado, se escribe un adaptador propio.
- [El parser SSE corta mal con payloads partidos entre chunks] → se acumula el
  buffer y solo se procesan líneas completas; test con chunks partidos a mano.
- [Una tool call sin `index`] → se asume índice 0 cuando falta.
- [Config con una key literal] → se rechaza al cargar y se indica usar
  `variableApiKey`; nunca se loguea el contenido del archivo.
- [Sin CI contra APIs reales] → la suite usa servidor falso; una prueba manual con
  una key real queda documentada, no automatizada.
