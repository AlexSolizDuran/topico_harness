# Alcance del harness

Documento de referencia. Define **qué es un harness**, cómo se construyen por
niveles, y qué entra en cada uno. Es la referencia de alcance; la especificación
formal vive en `openspec/specs/`.

El OpenSpec está escrito: las 5 capacidades de `openspec/specs/` cubren los niveles
0 a 2 de abajo — `core` (nivel 1), `provider` (nivel 0), `tools` (nivel 1),
`context` (nivel 2) e `interface`. Ninguno está implementado todavía.

**Si los dos se contradicen, el spec manda.** Este documento explica el porqué de
cada decisión; el spec dice qué tiene que hacer el sistema.

## Qué es un harness

> El modelo no puede hacer nada por sí solo.

Un LLM es una función: texto entra, texto sale. No lee archivos, no corre
comandos, no recuerda lo que dijo hace dos turnos.

El **harness** es el programa que le da eso. Es el loop, las tools, la gestión
de contexto, los límites y la memoria.

- **El modelo** es el motor.
- **El harness** es el chassis.

Si solo mandás un prompt y printing la respuesta, no tenés un harness. Tenés un
`curl`.

## El flujo que nunca cambia

Antes de los niveles, el esqueleto. Esto es igual en todos:

```
mensajes ──► provider.stream() ──► evento* ──┬──► texto      ──► UI
                                              ├──► tool_call  ──► despachar
 │                      │
                                              │                ejecutar│
                                              │                      ▼
                                              │              resultado ──┐
                                              │                          │
                                              └──► finish ──► salir  │
                                                                         │
 ◄──── sumar el resultado a mensajes ──────────────┘
```

Ese `return` es el harness. Todo lo demás es detalle de cada nivel.

## Corrección a la premisa

La intuición común es "cada nivel es algo funciona y mejor que el anterior".
Es casi cierto, pero con un matiz que importa:

> Cada nivel es **más capaz**, no **más confiable**.

Cada nivel también **agrega superficie de bugs**. Un Nivel 1-tight le gana a un
Nivel 3-desordenado.

De ahí sale la regla práctica:

> **No construyas el nivel N+1 hasta que el N te haya fallado en la cara.**

Si no sentiste la pared, estás construyendo a ciegas. Esta regla sola te
ahorra semanas.

## Los cuatro ejes

Los niveles 0-4 cuentan una sola historia: un agente que mejora. Ese es solo
**uno** de los ejes. Los harnesses maduros crecen en cuatro ejes independientes,
y cada uno se sube por separado.

| Eje | Qué hace crecer | Niveles |
|---|---|---|
| **Capacidad** | Qué puede hacer el agente | 1, 5 |
| **Contexto** | Qué cabe antes de romperse | 2, 6 |
| **Autonomía** | Cuántos agentes, cómo se coordinan | 3, 4 |
| **Confianza** | Qué se le permite sin preguntarte | 4, 7 |

Hay un quinto eje que es independiente de los otros cuatro:

| Eje | Qué hace crecer |
|---|---|
| **Memoria** | Qué recuerda **entre sesiones** |

Un harness puede ser excelente en los cuatro primeros y olvidar todo al cerrar.
Un agente que es lento es corregible; uno que olvida es molesto todos los días.

## Referencia de escala

Para saber que no te falta pieza. Esto es el techo real, no un objetivo.

| Sistema | Tools | Componentes UI | Subsistemas |
|---|---|---|---|
| Claude Code | 43 | 144 Ink | hooks (26 eventos), sandbox, memoria, LSP, MCP |
| OpenCode | ~12 | — | agentes nombrados, permisos, worktrees, LSP |
| **Este harness, v1** | **6** | **~10** | — |

La distancia entre 6 tools y 43 es de meses, no de días. Sirve para saber que
no te falta nada, no para copiarse.

## La escalera

| Nivel | Nombre | Eje | Esfuerzo | "Funciona" si… |
|---|---|---|---|---|
| [0](nivel-0-one-shot.md) | One-shot | — | ½ día | ves la respuesta |
| [1](nivel-1-el-loop.md) | El loop | capacidad | días | completa una tarea multi-paso |
| [2](nivel-2-contexto.md) | Contexto | contexto | días | 1 hora sin degradarse |
| [3](nivel-3-subagentes.md) | Subagentes | autonomía | 1-2 días | investiga sin llenar tu contexto |
| [4](nivel-4-produccion.md) | Producción | confianza | 1-2 sem | no rompe cosas por sorpresa |
| [5](nivel-5-configuracion.md) | Configuración | capacidad | 2-3 días | agentes por nombre, tools en paralelo |
| [6](nivel-6-contexto-fino.md) | Contexto fino | contexto | 1 sem | compactación por etapas, sin parpadeos |
| [7](nivel-7-seguridad-integracion.md) | Seguridad e integración | confianza | 1-2 sem | hooks + sandbox + LSP |
| [8](nivel-8-memoria.md) | Memoria | memoria | 1-2 sem | la sesión 2 sabe lo de la 1 |

## Dependencias

```
0 ──► 1 ──► 2 ──► 4 ──► 7
          └─► 3 ──┘
          └─► 5 ──► 6, 8
```

Lo que importa de este diagrama:

- **2 y 3 son hermanos, no cadena.** El Nivel 3 evita necesitar el Nivel 2.
- **5 depende solo del 1.** No necesita contexto sano ni subagentes.
- **7 depende del 4**, porque los hooks y el sandbox se enganchan al gate de
  aprobación.

## Orden recomendado

```
v1  ─────────► 0, 1, 2, 3      "básico + subagentes"
v2  ─────────► 5, 8            configuración + memoria
v3  ─────────► 6, 7            contexto fino + seguridad
```

**El Nivel 5 va segundo, no último.** Son 2-3 días de trabajo y dan agentes
nombrados, tools en paralelo, permisos como datos y detección de loops. Es la
mejor relación esfuerzo/valor de toda la escalera, y hace falta antes del
Nivel 7.

**El Nivel 8 va temprano** por una razón concreta: un harness sin memoria te
hace explicar lo mismo cada sesión. Es la molestia diaria, aunque no rompa nada.

## Cómo leer los archivos

Cada nivel tiene la misma estructura:

| Sección | Qué contiene |
|---|---|
| Qué resuelve | El problema concreto que ataca |
| Las piezas | Cada pieza, con lo que hay que decidir |
| Equivalente en OpenCode | Qué hace OpenCode, para no reinventarlo |
| "Funciona" si… | El criterio observable de terminado |
| Trampas | Lo que sale mal, con el síntoma |
| Qué NO entra | Lo que se posterga y por qué |

## El mapa de archivos

```
alcance/
├── README.md                              este archivo
├── nivel-0-one-shot.md
├── nivel-1-el-loop.md
├── nivel-2-contexto.md
├── nivel-3-subagentes.md
├── nivel-4-produccion.md
├── nivel-5-configuracion.md
├── nivel-6-contexto-fino.md
├── nivel-7-seguridad-integracion.md
├── nivel-8-memoria.md
├── decisiones-abiertas.md                 lo que falta decidir
└── plan-implementacion.md                 el orden de los changes
```

## Lo que se imitó de OpenCode

Este harness toma de OpenCode un modelo mental concreto, no su código:

- **Tools nombradas y con schema**, no funciones sueltas. `read`, `write`,
  `edit`, `bash`, `glob`, `grep`, `task`.
- **Permisos como datos**, no como código. `allow` / `ask` / `deny`, con
  patrones y "la última regla que matchea gana".
- **Agentes nombrados** con roles, en vez de un agente único con ifs.
- **Errores que vuelven al modelo como texto**, nunca tirados.
- **Cortar, pedir permiso, relanzar** en vez de pausar el stream a la mitad.
- **Subagentes de solo lectura**, que no heredan los permisos del padre.