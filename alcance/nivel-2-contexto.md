# Nivel 2 — Contexto

**Eje:** contexto
**Esfuerzo:** días
**Depende de:** [Nivel 1](nivel-1-el-loop.md)

## Qué resuelve

El Nivel 1 se degrada con el tiempo. Esta es la razón por la que "funciona" y
"funciona el martes a la tarde" son cosas distintas.

## El problema, medido

Cada viaje manda **todo** el historial. El costo y la latencia crecen con los
viajes:

```
Viaje  1:   500 tokens     ~1s
Viaje 10:  8.000 tokens    ~4s
Viaje 25:  60.000 tokens   timeout
```

No es un problema de "se llena y listo". El modelo **degrada su calidad**
mucho antes de llegar al límite. Un historial largo de salidas viejas hace que
el modelo se distraiga con cosas que ya resolvió.

## Las piezas

| Pieza | Qué hace |
|---|---|
| **Presupuesto** | Un tope. Cuántos tokens caben, cuántos llevás, cuánto margen |
| **Contador** | Tokens aproximados, o tokenizer real del provider |
| **Trimming** | Cortar lo viejo antes de que reviente |
| **Compactación** | Resumir lo viejo en un párrafo y seguir |
| **Preservación** | Nunca cortar a la mitad |

### El contador

Lo primero que hay que decidir: **estimación o tokenizer real**.

| Opción | Costo | Precisión |
|---|---|---|
| `length / 4` | Cero | +-25%. Alcanza para decidir cuándo compactar |
| Tokenizer del provider | Una llamada más o un WASM | Exacta |
| Conteo del propio provider | Ya viene en la respuesta de cada viaje | Exacta, gratis |

La tercera es la mejor si el provider la devuelve: ya la recibís. Usala cuando
esté; el tokenizer es el fallback.

El error clásico es inventar la estimación y cortar tarde. Con margen
deliberadamente conservador.

### Presupuesto

```
usado = suma(tokens de todos los mensajes)
margen = usado - capacidad_total
```

Lo que **no** es el presupuesto:

- No es el largo del prompt del sistema
- No es lo que vos creés que vale, es lo que el provider cuenta
- No es un número fijo: cambia con el modelo

### Trimming: cortar sin resumir

Lo más barato. Antes de perder información, se recorta lo que ya no sirve.

```
[user] agregá un test
[assistant] ok, leo...                ← se conserva
[tool] <contenido de 8KB>             ← se enmascara: "omitido, ya aplicado"
[assistant] encontré el patrón en...  ← se conserva
[user] y ahora arreglame el import     ← se conserva
```

Regla: **enmascará salidas viejas de tools**, no mensajes del usuario. El
contenido de un `read` que el modelo ya procesó no le sirve de nuevo.

### Compactación: resumir de verdad

Más caro, se hace cuando el trimming no alcanza.

```
ANTES (50 turnos)                    DESPUÉS (50 turnos → 6)
──────────────────                   ──────────────────────────
[user] agregá test X                 [user] agregá test X
[assistant] ok, leo...               [system: resumen] Se exploró utils.ts,
[tool] <contenido largo>             se creó test/utils.test.ts, el primer
[assistant] encontré...              intento falló por un import mal
...49 mensajes más...                escrito, ya corregido. Último
                                      test: pasa.
                                    [assistant] ...últimos 6 turnos reales
```

**El resumen tiene que capturar decisiones, no narrativa.**

| Mal | Bien |
|---|---|
| "El asistente buscó en varios archivos" | "La función está en `src/utils.ts:44`, no en `helpers/`" |
| "Hubo un error y se corrigió" | "El import falló por path relativo; ya corregido" |

## Reglas que no se rompen

Tres reglas de las que depende todo lo demás. Si las violás, el provider
rechaza la request y el harness se muere.

### 1. Nunca cortar entre un `tool` y su `assistant`

La secuencia es atómica:

```
[assistant con tool_call]  ←── no cortás acá
[tool con resultado]      ←── ni acá
[assistant con respuesta] ←── cortás por acá sí
```

Un `tool` sin su `assistant` es un historial inválido. Es el error que más rompe.

### 2. El prompt del sistema es intocable

Si se cae, el modelo deja de saber qué hacer. Se conserva siempre, cueste lo que
cueste.

### 3. El resumen va marcado como resumen

Si no, el modelo lo toma por hechos:

```
[system] RESUMEN DE LA SESIÓN ANTERIOR (generado automáticamente,
         no son hechos verificados): ...
```

La diferencia es subtle pero real: sin la marca, el modelo va a citar el
resumen como si lo hubiera comprobado.

## Equivalente en OpenCode

OpenCode tiene un **agente oculto `compaction`** que no se puede seleccionar en
la UI. Corre automáticamente, resumiendo a un modelo propio.

Detalle de diseño que vale copiar: el agente de compactación usa el modelo
configurado para compactación, que puede ser **más barato** que el principal.
Resumir no necesita el modelo caro.

OpenCode también expone compactación explícita por comando, para que el
humano la dispare cuando quiere y no solo por umbral.

## "Funciona" si

Una sesión de una hora sin degradarse: costo estable, latencia estable, y el
modelo todavía recuerda lo que decidió al principio.

## Trampas

| Trampa | Síntoma |
|---|---|
| Cortar entre `tool` y su `assistant` | El provider rechaza todo el historial |
| Resumir sin marcar | El modelo toma el resumen por hechos |
| Contador inventado | Revienta antes de tiempo |
| Recompactar en cada paso | Caro y deforma el contexto |
| Enmascarar contenido que sigue en uso | El modelo re-pide lo que le borraste |
| Resumir en mitad de un turno | Rompe el stream; hay que esperar al fin del turno |
| Preservar el prompt del sistema pero recortar el objetivo | El modelo cumple el prompt pero pierde tu tarea |

La de recompactar en cada paso merece detalle: si compactás antes de cada
llamada, estás pagando un LLM entero por viaje y el contexto se deforma. La
compactación va **al final del turno**, cuando ya terminaste.

## Qué NO entra

Subagentes, aprobaciones, memoria, LSP.

## Nota importante

Existe una alternativa a este nivel que **cuesta menos**: el
[Nivel 3](nivel-3-subagentes.md). Un subagente con contexto aislado evita que
el contexto principal crezca, sin ninguna maquinaria de compactación.

Si tu v1 va con subagentes, este nivel se puede postergar. Es exactamente lo que
hice en el plan: Nivel 2 entra, pero no es crítico para la v1.