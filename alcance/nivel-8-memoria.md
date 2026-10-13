# Nivel 8 — Memoria

**Eje:** memoria
**Esfuerzo:** 1-2 semanas
**Depende de:** [Nivel 1](nivel-1-el-loop.md)

## Por qué es un eje aparte

Los niveles 0-7 mejoran **la sesión actual**. La memoria mejora **la próxima**.

```
sesión 1:  "usamos Vitest, no Jest"  →  se pierde al cerrar
sesión 2:  "agregá un test"           →  usa Jest otra vez
sesión 3:  "usamos Vitest, no Jest"  →  te lo vuelve a decir
```

Es el eje que más superficie de UI tiene y el que menos "se ve" como feature. No
rompe nada. Solo te hace explicar lo mismo todos los días.

Por eso va temprano: es la molestia diaria aunque no falle nunca.

## El problema concreto

Cuatro categorías de cosas que el agente debería saber y no sabe:

| Tipo | Ejemplo |
|---|---|
| **Convenciones** | "usamos Vitest, no Jest" |
| **Decisiones** | "el auth es a mano, no Auth.js, porque serverless" |
| **Errores previos** | "esto ya falló 3 veces, no lo intentes así" |
| **Estructura** | "el frontend está en `src/app`, no en `pages/`" |

Las tres primeras son **contexto de proyecto**. La cuarta lo tiene cualquier
indexador de código.

Un `AGENTS.md` bien escrito resuelve las cuatro. La parte difícil es
**mantenerlo actualizado** sin que el humano se acuerde.

## La pieza barata: archivos

Sin base de datos, sin esquema, sin infraestructura.

```
proyecto/
  AGENTS.md              instrucciones del proyecto, se carga siempre
  memoria/
    decisiones.md         por qué se eligió algo
    errores.md            "esto ya falló 3 veces"
    convenciones.md       cómo se escriben las cosas acá
```

Un `AGENTS.md` a mano resuelve el 80%. Es lo que ya hacés en
`finanzas/mvp`: un `AGENTS.md` con contexto del dominio, el stack, las reglas.

La v1 de memoria es **leer esos archivos al arrancar**. Nada más.

## La pieza difícil: auto-extracción

Que el agente descubra solo qué merece recordarse. Sin eso, los archivos se
quedan viejos y el agente los ignora.

### El patrón

```
al cerrar la sesión  →  un subagente barato lee el transcript
                     →  extrae hechos concretos
                     →  los escribe en memoria
                     →  se inyectan al arrancar la sesión siguiente
```

Lo caro no es la extracción. Es **decidir qué merece guardarse**. Hay que
filtrar el ruido:

```
mal:   "el usuario pidió agregar un test"           ← obvio, no hace falta
bien:  "el proyecto usa Vitest, no Jest, porque ESM" ← no es obvio
mal:   "el agente leyó 5 archivos"                  ← no sirve
bien:  "la función de validación está en validators/" ← ubicación no obvia
```

El filtro: **lo que un humano no podría deducir leyendo el código**.

### Modelo barato para la extracción

La extracción no necesita el modelo caro. Es una tarea de resumir. Usar un
modelo barato (Haiku, Flash, Mini) ahí:

- Barato
- Rápido
- Suficiente

Es la misma decisión que OpenCode toma para compactación: agente de compactación
con su propio modelo, potencialmente más barato que el principal.

### El detalle del límite de tamaño

Si la escritura de memoria excede el tope:

```
mal:   truncar en silencio             ← peor que no tener memoria
bien:  fallar con error explícito      ← el problema se ve
```

Truncarte los recuerdos sin avisarte es peor que la ausencia de memoria:
**creés que el agente sabe algo y no lo sabe**. Es peor que no tener nada, porque
la ausencia es visible.

Este es un principio general del harness, no solo de memoria: cualquier
limitación que se trunque en silencio hay que hacerla ruidosa.

## Curation: la parte que nadie quiere hacer

La memoria se pudre. Después de 20 sesiones:

```
memoria/
  decisiones.md   ← 200 líneas, 180 obsoletas
  errores.md      ← cosas que ya se arreglaron
```

Un archivo de memoria que no se curia **empeora el agente**, porque le inyecta
información falsa con confianza.

Señales de que hay que curar:

| Señal | Qué hacer |
|---|---|
| El agente repite un consejo obsoleto | Borrarlo |
| Un error que ya no ocurre | Sacarlo |
| El archivo supera ~200 líneas | Podar lo que no se use |
| Decisiones que se contradicen | Marcar la vieja como superada |

El patrón de Claude Code: se inyectan las primeras ~200 líneas al arrancar, y
los detalles van a archivos separados que se cargan **bajo demanda**. El
archivo índice se mantiene chico; lo grande está aparte.

```
memoria/
  INDICE.md        ← 40 líneas, se carga siempre
  decisiones/
    2026-01-auth.md
    2026-02-dinero.md
```

## Ámbito

La memoria no debería ser global por defecto. Es código de proyecto, y va con el
proyecto.

| Ámbito | Ubicación | Dura |
|---|---|---|
| **Proyecto** | `<proyecto>/memoria/` | Con el repo. Compartida |
| **Usuario** | `~/harness/memoria/` | Entre proyectos. Preferencia personal |
| **Sesión** | En memoria | Se pierde. No cuenta |

Regla: si un recuerdo depende del proyecto, va con el proyecto. Si depende de
cómo trabaja la persona, va en el usuario.

Mezclarlos produce el error clásico: preferencias de un proyecto contaminan otro.

## Equivalente en OpenCode

| Pieza | En OpenCode |
|---|---|
| Instrucciones | Archivos `AGENTS.md`, cargados al inicio |
| Memoria automática | Se escriben en `~/.claude/.../MEMORY.md` por convención |
| Subagente de compactación | Agente oculto con su propio modelo |
| Inyección | Primeras ~200 líneas al system prompt |
| Auto-extracción | Un subagente barato al cerrar la sesión |
| Errores | Un write que excede el tope **falla**, no trunca |

Lo relevante del detalle del tope: Claude Code cambió truncar en silencio por
fallar explícitamente. Es exactamente el principio de "si lo truncás, que se
vea".

## "Funciona" si

1. Arrancás una sesión nueva y el agente ya sabe las convenciones del proyecto
2. Le decís algo nuevo y **queda** para la próxima
3. La memoria no tiene cosas falsas
4. Si un archivo de memoria se llena, el harness lo dice en vez de cortar

## Trampas

| Trampa | Síntoma |
|---|---|
| Memoria global | Preferencias de un proyecto contaminan otro |
| Guardar todo | La memoria se llena de ruido y el agente lo ignora |
| Truncar en silencio | El agente cree saber y no sabe |
| No curar | Información obsoleta con confianza: **empeora** el agente |
| Extraer con el modelo caro | Caro y lento para resumir |
| Guardar lo que se deduce del código | Ruido, sin información |
| Solo memoria, no instrucciones | La memoria es para lo que cambió, no para lo estable |

La última tiene un matiz que vale aclarar. Las **instrucciones** son para lo
estable (convenciones, estructura, reglas). La **memoria** es para lo que
aprendiste. Mezclarlas hace que las instrucciones envejezcan mal, porque cambian
por decisión del equipo, no por aprendizaje del agente.

## Qué NO entra

Nada, este es el último nivel. Los hooks del Nivel 7 son los que disparan la
auto-extracción en `sessionEnd`.

## Criterio de terminado

1. Un `AGENTS.md` se lee al arrancar y el agente lo respeta
2. Algo aprendido en la sesión 1 aparece en la sesión 2
3. Un archivo de memoria que excede el tope **falla**, no trunca
4. El contenido de memoria se puede revisar y editar a mano
5. La memoria es del proyecto, no global