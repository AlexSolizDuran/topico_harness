# Nivel 6 — Contexto fino

**Eje:** contexto
**Esfuerzo:** 1 semana
**Depende de:** [Nivel 2](nivel-2-contexto.md)

## Qué resuelve

El Nivel 2 compacta de golpe: cuando se llena, resume. Funciona, pero paga
tokens en el momento equivocado y deforma el contexto de golpe.

Este nivel hace la compactación **progresiva y barata primero**.

## La idea

> No resumir cuando se llena. Reducir por etapas, de barato a caro.

Las primeras etapas son deterministas y gratis. Casi siempre alcanzan. Solo la
última paga una llamada al modelo.

## Las cinco etapas

```
70%  →  avisar
80%  →  enmascarar salidas viejas de tools
85%  →  podar turnos enteros que no contribuyeron
90%  →  resumir bloques grandes
99%  →  compactación completa con LLM
```

| Etapa | Costo | Qué hace | Reversible |
|---|---|---|---|
| Avisar | 0 | Nada, solo informa | Sí |
| Enmascarar | 0 | Reemplaza salidas viejas por un marcador | Sí |
| Podar | 0 | Elimina turnos enteros | No |
| Resumir | 1 LLM | Un bloque → un párrafo | No |
| Compactar | 1 LLM | Todo → un resumen | No |

Las dos primeras son **reversibles**. Eso importa: si el modelo dice "necesito
volver a ver ese archivo", se puede restaurar.

### Por qué importa el orden

El orden no es arbitrario. Es de **menor pérdida a mayor pérdida**:

```
enmascarar  >  pierde contenido viejo, recuperable
podar       >  pierde turnos enteros, irrecuperable
resumir     >  pierde detalle, requiere LLM
compactar   >  pierde todo el detalle, requiere LLM
```

Se empieza por lo barato y reversible, y se escala solo si no alcanza.

### La etapa de enmascarar es la estrella

Es la que más rinde y la más subestimada. Un `read` de 8KB que el modelo ya
procesó no le sirve de nuevo:

```
antes:   [tool] <8KB de contenido de archivo>
después: [tool] [contenido omitido: 8KB, ya leído en el paso 3]
```

Cuesta cero, es reversible, y en una sesión típica recupera 40-60% del espacio.

El riesgo: si el modelo **necesita** volver atrás, se queda sin. Por eso el
marcador tiene que decir **dónde** se puede recuperar:

```
[contenido omitido: 8KB. Releer con read("src/utils.ts")]
```

## Recordatorios de sistema

El problema opuesto a la compactación: el modelo se desvía después de 20 pasos.

Un recordatorio inyectado en eventos:

```
- tras editar código  →  "Considerá correr las pruebas"
- tras 15 pasos sin escribir  →  "Recordá el objetivo original: <tarea>"
- tras un compactar  →  "Acá va el resumen de lo que venías haciendo"
```

Barato, en `nucleo/`, y ataca directamente la **degradación por atención**: el
modo de falla más silencioso, porque el harness sigue andando y el resultado
empeora sin que nada se rompa.

### El recordatorio del objetivo

Es el más importante y el más barato. El agente pierde de vista qué le pediste,
empieza a optimizar otra cosa, y a los 30 pasos está haciendo otra cosa.

```
[system] Objetivo original de esta sesión: "agregá un test para la división".
         Vas en el paso 18. Seguí atacando este objetivo.
```

## Caché de prompts

Las APIs de Anthropic y OpenVercel cobran **mucho menos** si el prefijo del
request es byte-idético. Eso impone restricciones reales al diseño:

1. **System prompt fijo al principio.** Nunca lo reescribas con variables que
   cambian.
2. **Tools en orden estable.** El mismo orden siempre.
3. **Historial que solo crece.** Nunca reordenes mensajes.

### El conflicto con la compactación

Si compactás en medio de la conversación, **rompés la caché**. Cada compactación
invalida todo el prefijo.

De ahí sale una regla de diseño no obvia:

> **La compactación va al final del turno**, nunca en mitad de un stream.

Cuando termina el turno, se compacta, y el siguiente turno arranca con un
prefijo nuevo (cacheado desde cero). El costo se paga una vez por turno, no
por viaje.

## Cola de shell

El agente corrió `npm test` y le devolviste 50KB de log. Lo que realmente
necesita:

```
al agente:    los últimos 20KB + "…se omitieron 30KB de errores anteriores"
a la pantalla: lo que el humano mira (la cola completa, scrolleable)
```

**Dos vistas del mismo resultado.** Los logs existen para el humano; el modelo
necesita la señal, no el volumen.

El detalle de implementación: la cola tiene que ser **por comando**. El error del
`npm test` del paso 12 no se mezcla con el del `git status` del paso 7.

## Equivalente en OpenCode

OpenCode tiene un pipeline de compactación de **cuatro niveles**, no uno:

| Nivel | Qué hace |
|---|---|
| snip | Recorta tokens desperdiciados de bloques sueltos |
| micro | Compactación de bloques pequeños |
| collapse | Proyección de lectura, **reversible** |
| auto | Trigger por umbral, guarda el transcript y resume todo |

Dos detalles que vale copiar:

**Los niveles corren en orden y no son excluyentes.** Se pueden aplicar juntos,
cada uno recupera lo que puede.

**El nivel de `collapse` es una proyección de lectura**: no modifica datos, solo
cómo se leen. Eso lo hace reversible y le permite persistir entre turnos.

Claude Code tiene algo equivalente con 4 niveles y ganchos
`PreCompact` / `PostCompact` para observar esa frontera.

## "Funciona" si

1. Una sesión larga activa las etapas baratas primero y la cara al final, si
   hace falta
2. El modelo nunca pierde de vista el objetivo, aunque vaya en el paso 30
3. El costo por request se mantiene bajo en turnos largos
4. Un log de 50KB no llena el contexto y el humano puede leerlo entero

## Trampas

| Trampa | Síntoma |
|---|---|
| Enmascarar contenido que sigue en uso | El modelo re-pide lo que le borraste |
| Podar antes que enmascarar | Perdiste contenido irrecuperable sin necesidad |
| Compactar en mitad del stream | Rompe el stream y la caché |
| Reordenar tools por permisos | Rompe la caché en cada request |
| Enmascarar sin decir cómo recuperar | El modelo no sabe que puede releer |
| Cola de shell mezclando comandos | El error viejo se confunde con el nuevo |
| Recordatorio en cada paso | Ruido constante; el modelo lo ignora |

## Qué NO entra

Aprobaciones, hooks, sandbox, memoria.

## Criterio de terminado

1. Las etapas se activan por umbral y la mayoría de las veces alcanzan las dos
   baratas
2. El enmascarado es reversible y dice cómo recuperar
3. La compactación ocurre **entre** turnos, nunca durante un stream
4. El objetivo original se reinyecta al desviarse