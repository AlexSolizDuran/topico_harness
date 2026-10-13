# Nivel 0 — One-shot

**Eje:** —
**Esfuerzo:** media tarde
**Depende de:** nada

## Qué resuelve

Nada. Este nivel existe para **descartar problemas falsos**.

La utilidad real es diagnóstica: antes de culpar a tu loop por un bug, probá
que la API, la key y el modelo andan. Media tarde te ahorra un día de depuración
equivocada.

## Qué entra

Una llamada al provider, imprimir la respuesta. Streaming opcional.

```ts
// esqueleto, no es la implementación
main() {
  const stream = provider.stream({ prompt });
  for await (const evento of stream) {
    if (evento.tipo === 'texto') stdout.write(evento.valor);
  }
}
```

Eso es todo. Sin loop, sin tools, sin historial.

## Las piezas

| Pieza | Qué es |
|---|---|
| Cliente del provider | La llamada HTTP, con la key desde `env` |
| Modelo de mensajes | El array que mandás, acá con un solo elemento |
| Lectura del stream | Consumir eventos y distinguishing texto de tool calls |

La tercera es la única con detalle real. Aunque no uses tools, el stream trae
varios tipos de evento y tenés que saber cuáles te importan.

## Equivalente en OpenCode

OpenCode tiene esto y lo esconde detrás de `opencode run "prompt"`, el modo
no-interactivo. Existe justamente para esto: correr un prompt, obtener salida,
verificarla.

## "Funciona" si

Ves una respuesta que llega token a token y podés confirmar que la key es
válida y que el modelo tiene tool calling.

## Trampas

| Trampa | Síntoma |
|---|---|
| Imprimir cada token sin buffer | La salida se ve temblorosa, ilegible |
| Loguear la request completa | La key queda en el log. Nunca loguees headers |
| Ignorar el `finishReason` | No distinguís "terminó" de "se cortó por límite" |
| Probar solo con un modelo | Un provider puede tener tool calling y otro no |

La primera es cosmética pero hay que resolverla ya, porque después toda la UI
hereda el problema.

## Qué NO entra

Loop, tools, cancelación, contexto, historial, subagentes. Nada de eso.

## Por qué va primero

No es un nivel que "se implemente". Es un nivel que **se ejecuta**. Media tarde
que te dice si tu provider anda.

El error clásico es saltar directo al Nivel 1, fallar por una key mal escrita y
perder dos horas buscando el bug en el loop.