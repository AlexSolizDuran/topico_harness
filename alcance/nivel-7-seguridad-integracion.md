# Nivel 7 — Seguridad e integración

**Eje:** confianza
**Esfuerzo:** 1-2 semanas
**Depende de:** [Nivel 4](nivel-4-produccion.md) (aprobaciones), [Nivel 5](nivel-5-configuracion.md) (permisos)

## Qué resuelve

El Nivel 4 pregunta al humano antes de una acción peligrosa. El Nivel 7 agrega
dos cosas distintas:

1. **Restricción sin humano.** Un hook que se dispara siempre.
2. **Aislamiento real.** Un límite del sistema operativo, no una promesa.

Y dos integraciones que cambian lo que el agente puede hacer: entender el código
por símbolos, y conectarse a fuentes externas.

## Las piezas

| Pieza | Qué resuelve |
|---|---|
| **Hooks** | Acciones deterministas que el modelo no puede saltear |
| **Aislamiento** | Límites del OS, no del modelo |
| **LSP** | Inteligencia de código por símbolos |
| **MCP** | Conectar fuentes externas |

## Hooks

> Un hook **no depende de que el modelo se acuerde**.

Esa es toda la diferencia con un prompt. Un prompt es una sugerencia; un hook es
una intercepción.

```
antes de Write   →  un script valida formato, tipos
después de Bash  →  lint + typecheck
antes de Edit    →  snapshot para poder deshacer
al arrancar      →  ver que el repo está en un estado conocido
```

### Los eventos que importan

No hace falta cubrir 26 eventos como hace Claude Code. Con cinco alcanza:

| Evento | Para qué |
|---|---|
| `sessionStart` | Cargar memoria, verificar estado del repo |
| `preTool` | Validar antes de actuar |
| `postTool` | Verificar después (lint, types) |
| `turnEnd` | Compactar, evaluar si sigue |
| `sessionEnd` | Extraer memoria, limpiar |

### Bloquear vs avisar

El código de salida decide:

| Código | Significado |
|---|---|
| 0 | Success, sigue |
| 1 | Advertencia, sigue pero anota |
| 2 | **Bloquea** la acción |

El `2` es lo que hace que un hook sea una garantía y no un comentario. Si el
hook de formato falla, la escritura **no ocurre**.

### Por qué hooks y no prompts

| Mecanismo | Se saltea si… |
|---|---|
| Prompt | El modelo decide que no hace falta |
| Permiso | El usuario aprueba sin mirar |
| **Hook** | Solo si el modelo ejecuta el comando malicioso directamente |

Ese último caso es el que importa: `bash` puede hacer lo que quiera. Solo sirve si el hook corre **dentro** del sandbox. Si el hook corre afuera, es decorativo.

## Aislamiento

Cuatro niveles, de barato a caro:

| Nivel | Mecanismo | Costo | Qué frena |
|---|---|---|---|
| **Permiso** | `ask` / `deny` | ~0 | Acciones conocidas |
| **Lista negra** | regex sobre `bash` | bajo | `rm -rf`, `sudo`, `curl \| sh` |
| **Sandbox de kernel** | `bwrap` / `landlock` | medio | Escrituras fuera del proyecto |
| **Worktrees** | Un agente = un branch | bajo | Conflictos entre agentes |

### El sandbox no es negociable si hay `bash`

La lista negra **siempre** se puede saltear. `bash` puede hacer 500 cosas
distintas; tu regex cubre 20. Un modelo con un error raro te la va a saltear.

Un sandbox de kernel dice: "puede correr comandos, pero solo puede escribir
dentro de `/home/usuario/proyecto`". Eso no depende de adivinar qué comando
viene.

En Linux, `bwrap` (bubblewrap) o Landlock. El detalle: el sandbox se aplica
**por herramienta**, y `bash` siempre va dentro. `read` puede quedar afuera si
querés, porque leer no destruye.

### Worktrees: el subproducto útil

Si dos agentes escriben a la vez, cada uno en su rama, se pueden paralelizar
**sin conflictos de archivo**.

Eso no es solo seguridad: es lo que habilita el paralelismo real del Nivel 4. Sin
worktrees, dos agentes que escriben se pisan y hay que serializarlos.

## LSP

> `grep "getUser"` encuentra 200 cosas. `findReferences("getUser")` encuentra 4.

Y sabe cuáles son la definición, cuáles son usos, y cuáles son código muerto.

Operaciones que vale la pena exponer:

| Operación | Para qué |
|---|---|
| `goToDefinition` | dónde está definido |
| `findReferences` | dónde se usa |
| `documentSymbol` | qué hay en el archivo |
| `workspaceSymbol` | qué hay en el proyecto |
| `hover` | tipo y firma |
| `diagnostics` | qué está roto |

### El bonus que casi nadie menciona

**Los diagnósticos de tipos vuelven al agente.**

```
[assistant] edit(agregar función nueva)
[tool]     edit aplicado
[hook]     diagnostics → 3 errores de tipos en archivo.ts

[assistant] "Hay 3 errores de tipos, los corrijo" + edit
```

Es el ciclo más corto posible: el agente se entera del error de compilación y
lo arregla **sin que vos le digas nada**. Es el mayor multiplicador de calidad
por línea de código de toda esta lista.

Sin LSP, el agente no se entera hasta que corrés el test. Con LSP, se entera al
guardar.

## MCP

Servidores externos que agregan tools. La utilidad: **no lo implementás, lo
conectás**.

```
mcp_servers:
  postgres:   comandos → "consultá la base"
  github:     comandos → "mirá el issue"
  browser:    comandos → "abrí la página y probá el flujo"
```

### Carga perezosa

El problema: si cargás 40 tools de MCP, cada request manda 40 schemas y el
contexto se llena de descripciones que el modelo no va a usar.

La solución es cargar solo las tools del servidor que se está usando. Se conecta
el servidor, y solo entonces aparecen sus tools.

## Equivalente en OpenCode

| Pieza | En OpenCode |
|---|---|
| Permisos | Sistema completo con wildcards y `external_directory` |
| LSP | Herramienta `lsp`, experimental, con las operaciones de la tabla |
| MCP | Servidores configurables, con carga bajo demanda |
| Plugins | Ganchos JS para hooks de ciclo de vida |
| Worktrees | Cambio de worktree como límite de aislamiento |
| `question` | Tool para que el agente pregunte al usuario |

Dos detalles que valen copiar:

**La tool `question`**. El agente puede preguntar. No es lo mismo que pedir
permiso: es pedir **dirección**. Aclarar una ambigüedad antes de actuar, en vez de
adivinar y rehacer.

**Plugins como ganchos JS**, no solo hooks de shell. Permite lógica que el shell
no expresa.

## "Funciona" si

1. Un hook de formato bloquea una escritura mala y el modelo lo sabe
2. `bash` no puede escribir fuera del proyecto, aunque el modelo lo intente
3. El agente se entera de un error de tipos sin que vos corras nada
4. Conectás un MCP y aparecen tools nuevas sin tocar el código

## Trampas

| Trampa | Síntoma |
|---|---|
| Hook que solo avisa | El modelo sigue igual; no es garantía |
| Hook que corre afuera del sandbox | Decorativo, se saltea |
| Lista negra como única defensa | `bash` la saltea en 20 llamadas |
| Sandbox que rompe el build | Los comandos que necesitan `/tmp` fallan |
| LSP que no está bien configurado | El agente prefiere `grep` y pierde |
| Cargar todas las tools de MCP | El contexto se llena de schemas |
| Hooks lentos | Se ejecutan en cada tool; 500ms × 40 = molesto |

La de los hooks lentos es subestimada: un hook de 500ms en cada `write` se nota.
Los hooks pesados (typecheck completo) deberían ir en `sessionEnd` o ser
incrementales, no en `preTool`.

## Qué NO entra

Memoria (Nivel 8), contexto fino (Nivel 6).

## Criterio de terminado

1. Un hook con código 2 **bloquea** la acción y el modelo recibe el motivo
2. `bash` no puede escribir fuera del directorio del proyecto
3. Los diagnósticos de tipos vuelven al agente automáticamente
4. Un MCP nuevo aparece sin cambios en el código del harness