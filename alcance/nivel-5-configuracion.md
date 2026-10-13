# Nivel 5 — Configuración

**Eje:** capacidad
**Esfuerzo:** 2-3 días
**Depende de:** [Nivel 1](nivel-1-el-loop.md) **solamente**

## Por qué va segundo y no último

Es el mejor esfuerzo/valor de toda la escalera:

- **2-3 días** de trabajo
- No necesita contexto sano, ni subagentes, ni aprobaciones
- Da agentes nombrados, tools en paralelo, permisos como datos y detección de loops
- Es **precondición** del Nivel 7 (los hooks se enganchan al gate)

Además evita una reescritura. Si el Nivel 1 no está pensado con puntos de
extensión, el Nivel 5 es rehacer el loop.

## Qué resuelve

El harness de Nivel 1 es un agente único con un `switch` de tools. Eso no escala
ni es seguro. Este nivel convierte la configuración en **datos**.

## Las piezas

| Pieza | Qué hace |
|---|---|
| **Agentes nombrados** | Perfiles declarativos, no ifs |
| **Permisos como datos** | `allow` / `ask` / `deny` con patrones |
| **Ejecución paralela de tools** | Lectura concurrente, escritura serial |
| **Detección de loops** | Corta antes de que duela la factura |

## Agentes nombrados

Lo que OpenCode llama **primary** vs **subagent**, con perfiles declarativos:

| Perfil | Modo | Tools | Para qué |
|---|---|---|---|
| `build` | primary | todas | el default, hace el trabajo |
| `plan` | primary | lectura | analiza, no toca nada |
| `review` | subagent | lectura | auditar código |
| `explore` | subagent | lectura | buscar |

El modo define **cómo se invoca**:

| Modo | Cómo se usa |
|---|---|
| `primary` | el agente principal de la sesión; se cambia con Tab |
| `subagent` | solo desde otro agente, vía la tool `task` |
| `all` | cualquiera de los dos |

### El detalle que importa: la tool no existe

`plan` **no tiene** `write` en su lista de tools. No es que la tenga y pida
permiso — **no existe en su schema**.

El modelo nunca ve la posibilidad. Eso es principio de menor privilegio
aplicado de verdad: la restricción está en la definición, no en la confianza.

```
Plan     = { read, glob, grep, lsp }              # no puede escribir
Build    = { read, write, edit, bash, glob, grep } # puede todo
Review   = { read, glob, grep }                    # ni bash
```

Agregar un agente nuevo es **escribir una definición**. No tocar el loop.

### La description es metadata de routing

El campo `description` de un subagente **se le muestra al modelo** que decide a
quién lanzar. No es documentación para humanos.

```
description: Busca código sin modificarlo
```

El modelo lee eso y decide: "esto es una búsqueda, lanzo a `explore`". Si la
description es vaga, el modelo no sabe cuándo lanzarlo.

## Permisos como datos

El patrón completo:

```
read:               allow
edit:               ask
bash:               { "*": ask, "git *": allow, "npm test*": allow, "rm *": deny }
task:               allow
external_directory: ask
```

Tres reglas:

1. **La última que matchea gana.** Poné el comodín `"*"` primero y las
   específicas después.
2. **Es un dato, no código.** Un objeto, serializable, versionable.
3. **Se mergea por agente.** Los globales primero, los del agente después. El
   agente refina.

### Defaults que importan

Los defaults de OpenCode, que son una guía razonable:

| Permiso | Default | Razón |
|---|---|---|
| mayoría | `allow` | no molestar al usuario |
| `read` de `*.env` | `deny` | secretos |
| `read` de `*.env.example` | `allow` | es público por diseño |
| `external_directory` | `ask` | salir del workspace es raro |
| `doom_loop` | `ask` | te avisa antes de pagar |

El de `.env` es el detalle fino: leer el `.env` se deniega, pero leer el
`.env.example` se permite. Distingue "secreto" de "plantilla".

### `doom_loop` como permiso

La detección de loops **es un permiso**, no un error. Cuando el mismo tool con
los mismos args se repite 3 veces, dispara.

Eso convierte un bug del modelo en un aviso, en vez de una factura de $40.

## Ejecución paralela de tools

Este lo vas a necesitar antes de lo que pensás. La regla:

```
read, glob, grep, lsp   →  CONCURRENTES   (no tocan estado)
write, edit, bash       →  SERIALES      (tienen efectos)
```

Se agrupan las consecutivas del mismo tipo y se ejecutan por tandas.

Ganancia concreta: leer 10 archivos pasa de 10 viajes secuenciales a 1 tanda.
Con latencia de red, es la diferencia entre 4 segundos y 400ms.

**El orden importa.** El algoritmo es:

```
[read, read, read, edit, bash, read]  →  tanda A: los 3 read en paralelo
                                        tanda B: edit
                                        tanda C: bash
                                        tanda D: el read final
```

El `read` de la última tanda **ve** el archivo editado, porque `edit` ya terminó.

Ese detalle es lo que hace que la paralelización sea segura: respeta el orden
de las dependencias.

## Equivalente en OpenCode

Todo este nivel existe en OpenCode y está bien resuelto. Lo relevante:

- Permisos: `allow` / `ask` / `deny`, con wildcards y "última regla gana"
- Permisos por agente, mergeados con los globales
- `edit` cubre `edit`, `write` y `apply_patch` — **agrupados por efecto**
- `task` con permiso propio: puede denegar el lanzamiento de ciertos subagentes
- `steps` en la config: en el último paso quita las tools y pide resumen
- `--auto` para aprobar lo que no esté explícitamente denegado
- Agentes en Markdown, con frontmatter

El agrupamiento por **efecto** (`edit` cubre tres tools) es el patrón correcto:
el permiso responde "¿qué puede pasar?", no "¿qué mecanismo usa?".

## "Funciona" si

1. Cambiás de agente con Tab y cambia qué puede hacer
2. Un agente `plan` **físicamente** no puede escribir
3. Leés 10 archivos y tardás una tanda, no 10 viajes
4. El modelo repite `bash` tres veces iguales y el harness pregunta

## Trampas

| Trampa | Síntoma |
|---|---|
| Registro de tools como `switch` | El Nivel 5 es una reescritura |
| Permisos como código | No se configuran sin recompilar |
| `plan` que tiene `write` con permiso `ask` | El usuario lee 20 prompts |
| Paralelizar escrituras | Dos edits al mismo archivo se pisan |
| Paralelizar ignorando el orden | Un read ve un estado viejo |
| `description` ausente | El modelo no sabe cuándo lanzar el subagente |
| `always` sin scope | Aprueba de más para el resto de la sesión |
| Aprobar `rm *` por convenience | Bueno, no |

## Qué NO entra

Memoria, hooks, sandbox, contexto fino.

## Criterio de terminado

1. Agregar un agente es escribir un objeto, no tocar el loop
2. Todos los permisos son datos serializables
3. Las lecturas corren concurrentemente **respetando** el orden de las
   escrituras
4. La detección de loops dispara antes del tercer viaje repetido