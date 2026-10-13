# Nivel 4 — Producción

**Eje:** confianza
**Esfuerzo:** 1-2 semanas
**Depende de:** [Nivel 1](nivel-1-el-loop.md), [Nivel 2](nivel-2-contexto.md)

## Qué resuelve

Un harness de Nivel 1 **borra cosas sin avisar**. Ejecuta `rm`, sobrescribe
archivos, tira una sesión a los 20 pasos. Funciona, pero no lo dejás suelto.

Este nivel convierte "peligroso" en "previsible".

## El problema con el que arranca

```
LLM → bash("rm -rf src/legacy")
```

Sin gate, eso pasa. El Nivel 4 pone un humano en el medio.

## Las piezas

| Pieza | Qué resuelve |
|---|---|
| **Aprobaciones** | Frenar antes de una acción destructiva |
| **Persistencia** | Guardar y reanudar sesiones |
| **Paralelo** | Varios subagentes a la vez |
| **Patching** | Editar por bloques, no por reemplazo de texto |
| **Sesiones** | Árbol, ramificación, búsqueda |

## Aprobaciones: el detalle que casi nadie implementa bien

La intuición es "pausar el stream y preguntar". **Eso no funciona.**

El problema: si pausás el stream a mitad, el estado del request queda colgado.
No podés preguntar dentro de un request abierto de manera confiable.

La forma correcta tiene tres pasos:

```
1. El stream se CORTA al pedir la tool. Se cierra el request.
2. Se registra la tool llamada, sus args, y el estado del turno.
3. Se pide permiso. El usuario responde.
4. Se RELANZA el turno con el resultado de la aprobación agregado.
```

Es un viaje extra, pero es determinista. El estado nunca queda a medias.

O sea: **cortar, preguntar, relanzar.** Nunca pausar.

### Los tres resultados

Como OpenCode, una pregunta de permiso tiene tres salidas:

| Salida | Efecto |
|---|---|
| `once` | Aprueba solo esta llamada |
| `always` | Aprueba las futuras que matcheen el patrón, por el resto de la sesión |
| `reject` | Rechaza. La tool devuelve un error al modelo |

El `always` es lo que evita el fastidioso "aprobar 40 veces el mismo
`npm test`". El harness sugiere el patrón seguro (`git status*`) y el usuario
lo aprueba de una vez.

## Persistencia

Sin esto, cerrar el harness pierde todo.

```
sesión guardada = { mensajes, modelo, cwd, estado del turno }
```

Tres formatos, en orden de dificultad:

| Formato | Upside | Downside |
|---|---|---|
| **JSONL** (un mensaje por línea) | Append-only, recuperable, parcial si se rompe | Hay que reconstruir en memoria |
| JSON completo | Simple | Un corte de escritura pierde todo |
| SQLite | Consultable, transaccional | Un día de setup de más |

**JSONL es el correcto para la v1.** Append-only significa que un corte a
mitad del turno pierde solo ese turno, no la sesión entera.

## Paralelo

Varios subagentes a la vez. El subagente del Nivel 3 es síncrono: el padre
espera.

```
Nivel 3:   padre ──► subagente ──► padre espera ──► sigue

Paralelo:  padre ──┬─► subagente A ─┐
                    ├─► subagente B ─┼─► padre sigue trabajando
                    └─► subagente C ─┘
```

La dificultad no es correrlos en paralelo. Es:

1. **Recoger los resultados.** Si terminás el turno sin recoger, el trabajo se
   pierde.
2. **Cancelar los que sobran.** Si el padre ya tiene la respuesta, los otros
   deberían morir.
3. **Ordenar la llegada.** El padre recibe los resultados en orden de
   llegada, que es no determinista.

Esas tres cosas son la complejidad real del paralelismo, no la concurrencia.

## Patching estructurado

`edit` con reemplazo exacto de texto tiene un problema conocido: si el texto
aparece dos veces, el modelo no sabe cuál cambió. Y si el archivo cambió entre
la lectura y el edit, el patch falla de forma confusa.

El formato de parche con marcadores resuelve ambos:

```
*** Add File: src/nuevo.ts
*** Update File: src/existente.ts
*** Delete File: src/viejo.ts
```

Cada línea indica su intención. Es explícito donde el reemplazo de texto es
implícito.

## Equivalente en OpenCode

| Pieza | En OpenCode |
|---|---|
| Aprobaciones | `permission: allow / ask / deny`, con `--auto` para aprobar todo lo no denegado |
| Persistencia | Sesiones en disco, restaurables |
| Paralelo | Subagentes en background, con `task_status` y `task_cancel` |
| Patching | Herramienta `apply_patch` con marcadores `*** Begin Patch` |
| Sesiones | Comando `/session`, con lista y restauración |
| Worktrees | Un subagente = un branch aislado, en paralelo sin conflictos |

El worktree de OpenCode es el detalle más interesante de esta lista: si dos
agentes escriben a la vez, cada uno en su rama, **se pueden paralelizar sin
conflictos de archivo**. Eso resuelve un problema que en otro diseño exige
bloqueos.

## "Funciona" si

1. Le pedís borrar algo importante y **pregunta antes**
2. Cerrás el harness a mitad de tarea y lo reabres, y sigue
3. Cuatro subagentes corren a la vez y los cuatro resultados se recogen
4. Un `edit` sobre texto duplicado falla en vez de editar la copia equivocada

## Trampas

| Trampa | Síntoma |
|---|---|
| Pausar el stream para preguntar | Estado colgado, request huérfano |
| Guardar JSON completo | Un corte de escritura pierde la sesión |
| Paralelizar y no recoger resultados | Trabajo perdido al terminar el turno |
| Paralelizar y no poder cancelar | Agentes fantasma cobrando tokens |
| `edit` sin contexto del archivo | Cambia la copia equivocada |
| Aprobar sin mostrar los args | El usuario aprueba a ciegas |
| Aprobar una vez y no recordar | Se repregunta 40 veces lo mismo |

## Qué NO entra

Memoria, hooks, sandbox, LSP, contexto fino. Eso es [Nivel 7](nivel-7-seguridad-integracion.md)
y [Nivel 8](nivel-8-memoria.md).

## Nota sobre el orden

Este nivel **no es obligatorio para la v1**. Es el nivel que hace que el harness
sea seguro de dejar suelto.

Si la v1 solo lo vas a usar vos, en un repo con git, podés postergarlo y
priorizar el [Nivel 5](nivel-5-configuracion.md), que da más por el mismo
esfuerzo.

La excepción: si la v1 **ejecuta `bash` sin restringir nada**, el gate de
aprobación pasa de "nice" a "necesario desde el día uno". Es una decisión de
alcance, no de nivel.