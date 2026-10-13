# Plan de implementación

Cómo se baja de la escalera a código. **Todavía no hay OpenSpec**: este
documento propone el orden y lo que va en cada change.

## El alcance de la v1

**"Lo básico + subagentes" son los niveles 0 a 3.**

| Nivel | Entra | Razón |
|---|---|---|
| 0 | Sí | Media tarde. Descarta problemas falsos |
| 1 | Sí | El harness en sí |
| 2 | Sí | Sin esto se rompe a los 25 viajes |
| 3 | Sí | Es lo que pediste, y evita la compactación |

Quedan fuera: 4 (producción), 5 (configuración), 6 (contexto fino), 7
(seguridad), 8 (memoria).

**Son 4 capacidades, no 8.** Ese es el alcance.

## Los cuatro changes

```
010-nucleo      Nivel 1: loop, límite de pasos, AbortController, errores→texto
020-provider    Nivel 0: interfaz, streaming, backoff
030-tools       Nivel 1: read/write/edit/bash/glob/grep
040-subagentes  Nivel 3: contexto aislado, prompt propio, solo lectura
```

El prefijo numérico ordena el `openspec list`.

### Por qué este orden

**`020-provider` va segundo, no primero.** Parece contraintuitivo. La razón: el
Nivel 0 (una llamada) se hace primero **dentro** del change de `provider`, y
después `010-nucleo` usa esa interfaz. Si `provider` no existe primero,
`nucleo` no tiene contra qué probar.

En la práctica: `020-provider` es corto (una tarde) porque es el Nivel 0.

**`040-subagentes` va último** porque es el loop de `nucleo/` corriendo
recursivamente. Si el loop base no corta bien, los subagentes heredan el bug
multiplicado por N.

## Qué entra en cada change

### `010-nucleo` — El loop

El corazón. Sin esto no hay harness.

| Requisito | Del nivel |
|---|---|
| El loop itera hasta que el modelo termina | 1 |
| Los errores vuelven al modelo como texto | 1 |
| Los args se validan contra el schema | 1 |
| Hay un límite de pasos | 1 |
| `Ctrl+C` cancela el request en vuelo | 1 |
| La cancelación deja estado consistente | 1 |
| **El núcleo no importa nada de la UI** | regla |

El último es el que hace reversible la decisión terminal↔web. Se verifica con
un test que falla si `nucleo/` importa desde `ui/`.

### `020-provider` — La interfaz

| Requisito | Del nivel |
|---|---|
| Una interfaz agnóstica de provider | 0 |
| Traduce los eventos del provider a eventos internos | 1 |
| Reintentos con backoff ante 429 y 5xx | 0 |
| La API key viene del entorno, nunca de un evento | regla |
| Contador de tokens | 2 |

La regla de la key existe aunque la UI sea terminal, donde no hay red. Sirve
para que una futura UI web no rompa el patrón.

### `030-tools` — Las herramientas

| Requisito | Del nivel |
|---|---|
| `read`, `write`, `edit`, `bash`, `glob`, `grep` | 1 |
| Cada una declara su schema | 1 |
| El contenido de una tool se trunca | 1 |
| El error de una tool no tumba el loop | 1 |
| Lista negra mínima en `bash` | decisión 2 |

La última depende de la decisión abierta 2. Si se decide "sin gate", se
implementa solo la lista negra.

### `040-subagentes` — El aislamiento

| Requisito | Del nivel |
|---|---|
| El subagente tiene contexto aislado | 3 |
| Devuelve **un** resultado, no un stream | 3 |
| Solo tiene tools de lectura | 3 |
| No puede lanzar subagentes | 3 |
| La cancelación del padre mata al hijo | 3 |
| El padre no crece con la investigación | 3 |

## Los puntos de extensión

Esta es la parte del diseño que hace que los niveles 5-8 **no exijan
reescribir**. Va en los requisitos de `010-nucleo` desde el día uno:

| Extensión | Para qué nivel | Cómo |
|---|---|---|
| Registro de tools como **datos** | 5 | `nombre → { schema, ejecutar }`, no un `switch` |
| Evento por tool ejecutada | 7 | Los hooks se enganchan ahí |
| Evento por paso | 6 | Los recordatorios se enganchan ahí |
| Contador de tokens expuesto | 6 | Las etapas de compactación lo usan |
| `AbortController` inyectado | 3, 4 | Los subagentes heredan la cancelación |

Si los cinco están, el Nivel 5 es agregar. Si no, es reescribir el loop.

**Es lo único de la v1 que existe pensando en el futuro.** Todo lo demás es lo
que la v1 necesita para funcionar.

## Qué NO se escribe en la v1

Explícitamente, para que no aparezca "por falta de tiempo":

| Fuera | Nivel | Por qué |
|---|---|---|
| Aprobaciones con UI | 4 | Es Nivel 4 |
| Persistencia de sesiones | 4 | Es Nivel 4 |
| Agentes nombrados | 5 | Es Nivel 5 |
| Tools en paralelo | 5 | Es Nivel 5 |
| Detección de loops | 5 | Es Nivel 5 |
| Compactación progresiva | 6 | Es Nivel 6 |
| Hooks | 7 | Es Nivel 7 |
| Sandbox | 7 | Es Nivel 7 |
| LSP | 7 | Es Nivel 7 |
| MCP | 7 | Es Nivel 7 |
| Memoria automática | 8 | Es Nivel 8 |

Una excepción parcial: el **límite de pasos** del Nivel 1 cumple una parte de la
detección de loops del Nivel 5. Sale gratis con el Nivel 1.

## Estructura del repo

```
harness/
  AGENTS.md              Contexto que se carga en toda sesión
  CONTEXTO.md            Qué es el harness, alcance y no-alcance
  PREGUNTAS.md           Las decisiones abiertas
  package.json           Node 24, ESM, type: module
  tsconfig.json          strict
  biome.json
  openspec/
    config.yaml          Stack, reglas, flujo  ← el único lugar con nombres de librería
    specs/
      nucleo/spec.md
      provider/spec.md
      tools/spec.md
      subagentes/spec.md
    changes/
```

`alcance/` queda al lado, como documentación de referencia. Los **specs son
neutrales de stack**: no mencionan Ink, ni AI SDK, ni Vitest. Esos nombres viven
solo en `config.yaml`.

Esa regla viene del proyecto de finanzas y vale igual: si el stack cambia, los
specs sobreviven.

## Cómo se ejecuta el trabajo

Igual que en `finanzas/mvp`:

```bash
openspec new change 010-nucleo
```
```
/opsx-propose 010-nucleo    # proposal + design + tasks
# revisión humana
/opsx-apply                # implementa desde tasks.md
/opsx-archive              # lo mueve a changes/archive/
```

Cada change lleva `skip_specs: true` en su `.openspec.yaml`: no introduce
comportamiento nuevo, materializa lo especificado. Sin ese marcador,
`openspec validate` rechaza un change con cero deltas.

## Orden de los cambios, revisado

```
v1  ─────────► 010, 020, 030, 040     niveles 0-3
v2  ─────────► 050-config, 060-memoria  niveles 5, 8
v3  ─────────► 070-contexto, 080-seguridad  niveles 6, 7
```

**El Nivel 5 va segundo.** Son 2-3 días y da la mejor relación esfuerzo/valor de
toda la escalera.

**El Nivel 8 va temprano** por la molestia diaria: un harness sin memoria te
hace explicar lo mismo cada sesión.

## Verificación

Cada tarea de `tasks.md` lleva su prueba. El patrón que ya usaste en finanzas:
**cada grupo aterriza sus propias pruebas**, no se acumulan al final.

El núcleo se testea **sin UI**: es un bucle async que entra y sale con JSON. Por
eso la UI de la v1 puede ser mínima y el núcleo queda verificado de verdad.

Comandos:

```
npm run lint       biome
npm run typecheck  tsc --noEmit
npm test           vitest
```