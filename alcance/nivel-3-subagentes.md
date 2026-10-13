# Nivel 3 — Subagentes

**Eje:** autonomía
**Esfuerzo:** 1-2 días
**Depende de:** [Nivel 1](nivel-1-el-loop.md)

## Qué resuelve

El eje cambia acá: no es **tiempo** (como en el Nivel 2), es **escala de
investigación**.

## El problema

Pedile que busque algo en 20 archivos. En el agente principal:

```
viaje 3: lee a.ts (400 líneas)   → +5.000 tokens
viaje 4: lee b.ts (300 líneas)   → +4.000 tokens
viaje 5: lee c.ts (800 líneas)   → +9.000 tokens
...
```

Veinte lecturas y el contexto principal está lleno de **basura de búsqueda**. Ya
no le queda espacio para tu tarea real.

El modelo, además, degrada: está leyendo 20 cosas y no puede recordar cuál
importó.

## La solución

El subagente tiene su **propia lista de mensajes**. Se le da la pregunta,
trabaja, y se descarta entera.

```
Principal                          Subagente (contexto propio, aislado)
──────────                         ──────────────────────────────────────
"buscá dónde se valida el  ──────►│ lee 20 archivos, grep, compara
 formato de teléfono"              │
                                    │  su contexto se llena…
                                    ▼
"Está en src/validators/    ◄──────│ se descarta TODO
 telefono.ts:44"                   │  (incluido lo que encontró por el camino)
```

El padre recibe **una línea**, no veinte tool calls.

## Por qué esto es barato

Acá está la idea que te puede ahorrar un módulo entero:

> **Un subagente es una alternativa barata a la compactación.**

No necesitás resumir para que tu contexto no crezca. Necesitás que **el trabajo
grande ocurra en otro contexto**.

Si cada investigación grande va a un subagente y vuelve con una respuesta, tu
contexto principal queda chico sin ninguna maquinaria de compactación.

Por eso este nivel **no depende** del Nivel 2. Es hermano, no hijo. Es lo que
permite hacer la v1 sin compactación.

## Las piezas

| Pieza | Qué hace |
|---|---|
| **Contexto aislado** | Lista de mensajes propia. El padre no ve los intermedios |
| **Prompt propio** | Distinto del principal: "sé conciso, devolvé solo la respuesta" |
| **Resultado único** | El padre recibe texto. No un stream |
| **Profundidad** | Un subagente NO puede lanzar subagentes |
| **Cancelación** | Si el padre se cancela, el hijo también |
| **Instrumentos** | Solo las tools de lectura |

### Contexto aislado

El subagente arranca con **una** lista de mensajes: la pregunta y nada más. No
hereda el historial del padre.

Eso se parece a un problema (pierde el contexto de la tarea) y es un
beneficio (no carga con 50.000 tokens de historia que no le sirven).

Lo que sí recibe, si lo necesitás: el objetivo y el cwd. No el historial.

### Prompt propio

El prompt del subagente es **distinto** del principal. Tiene que instruir
distinto:

```
Principal:    "resolvé la tarea del usuario"
Subagente:    "buscá el patrón X en el repo. Leé lo necesario.
               Cuando termines, devolvé SOLO: los archivos y líneas
               donde está, en una lista. No expliques el proceso."
```

La segunda frase ("devolvé SOLO") es la importante. Sin ella, el subagente
devuelve un párrafo largo y el padre tiene que parsearlo.

### Instrumentos: solo lectura

**Un subagente con `write` y `bash` es un agente con permisos que se
auto-modificó.** Que sea solo-lectura no es una limitación, es diseño.

El subagente investiga. Si encuentra que hay que cambiar algo, lo **dice** y
decide el padre.

OpenCode lo hace exactamente así con `explore`, un subagente de solo lectura
para buscar código sin tocarlo.

### Profundidad

**Un subagente no puede lanzar subagentes.** Punto.

Es lo que corta la recursión. Sin este límite, un subagente que decide
"investiguemos esto más a fondo" genera otro, y el costo escala de forma que
nadie controla. Es el mismo error que las goroutines sin límite.

Alternativa si necesitás más profundidad: límite explícito de 2 niveles, con un
contador de presupuesto compartido. Más complejo; postergalo.

### Cancelación

Si el padre se cancela, el hijo **también**. Y al revés no: cancelar al hijo no
debe matar al padre.

El `AbortController` se propaga hacia abajo. El padre es dueño del árbol.

## El streaming anidado

**No lo hagas en la v1.** Es el feature más caro y de menor valor.

Mostrar en vivo lo que hace un subagente, anidado dentro del stream del padre,
requiere multiplexar eventos de dos fuentes en un solo scrollback, con cuidado
de no romper el append-only de `<Static>` en Ink. Días de trabajo para un efecto
cosmético.

La v1: el subagente es **un spinner con un resumen al final**.

```
⠴ Buscando en 20 archivos... (12s)
  → "Encontrado en src/validators/telefono.ts:44"
```

Es menos lindo y cumple.

## Equivalente en OpenCode

OpenCode tiene **subagentes nombrados** (`general`, `explore`, `scout`), que se
configuran en Markdown con frontmatter:

```markdown
---
description: Busca código sin modificarlo
mode: subagent
permission:
  edit: deny
  bash: ask
---

Buscá código. No modifiques nada.
```

Lo relevante:

- `mode: subagent` lo marca como no seleccionable como agente principal
- `permission` **por agente**, con las mismas reglas del Nivel 5
- `description` se le muestra **al modelo** que elige a quién lanzar. Es
  metadata de routing, no documentación
- El modelo elige el subagente por esa descripción, o lo invocás con `@nombre`
  a mano

OpenCode también tiene subagentes en **background**: el padre sigue trabajando y
el resultado llega como notificación en un turno posterior. Es Nivel 4.

## "Funciona" si

> *"Buscá en qué archivos se usa el patrón X y decime qué hacer con cada uno"*
> — el padre responde con una lista de 5 archivos con línea, y su contexto no
> creció 40.000 tokens.

## Trampas

| Trampa | Síntoma |
|---|---|
| Subagente que lanza subagentes | Recursión, costo disparado |
| Volcar el stream del hijo al padre | El scrollback se rompe |
| El hijo hereda permisos del padre | Un investigador que escribe archivos |
| El hijo no hereda la cancelación | Sigue cobrando después de `Ctrl+C` |
| Prompt sin "devolvé solo la respuesta" | Devuelve un párrafo que el padre tiene que parsear |
| El padre ve los intermedios | Perdiste toda la razón del nivel |
| `description` ausente en el subagente | El modelo no sabe cuándo lanzarlo |

## Qué NO entra

Paralelo (varios a la vez), background, worktrees, streaming anidado, equipos de
agentes.

## Criterio de terminado

1. El padre recibe una respuesta, no un stream
2. El contexto del padre **no crece** con la investigación
3. El subagente no puede escribir ni ejecutar
4. `Ctrl+C` en el padre mata al hijo
5. El modelo elige el subagente solo, por su descripción