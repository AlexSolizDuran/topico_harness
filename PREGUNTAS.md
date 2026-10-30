# Preguntas y decisiones

Lo que quedó por decidir y el registro de lo ya decidido. Las 12 capacidades de
`openspec/specs/` están implementadas; ninguna decisión abierta bloquea el
funcionamiento actual.

## Resueltas

Se documentan acá porque `alcance/decisiones-abiertas.md` es el registro original
y estas decisiones ya se escribieron en los specs.

### El provider de la v1

**Resuelto (`020-provider`, `265-config-compartida`).** OpenRouter, por su API
compatible con OpenAI y su catálogo de modelos. Ollama queda como alternativa
local. La configuración del proyecto (`.harness/config.json`) se versiona sin
secretos y exige `variableApiKey` leída desde `.env`; `apiKey` literal solo se
permite en la configuración global del usuario.

### Plataformas: Linux, macOS y Windows

**Decidido.** Invertido lo que decía `alcance/`, que las excluía. La CI en los tres
sistemas se monta con un archivo de 25 líneas, y la ejecución de comandos en
Windows se resolvió con PowerShell y una allowlist (`120-shell-windows`).

### Catálogo de comandos y lista negra

**Decidido.** Un catálogo por plataforma, y encima una lista negra por nombre
completo en Unix. Se descartó la clasificación por categoría de efecto: la
allowlist de Windows y la lista negra de Unix alcanzan.

**Revisado (`250-aprobacion-obligatoria`).** El catálogo y la lista negra dejaron
de rechazar: son etiquetas de riesgo que elevan la operación a una aprobación
obligatoria. Nada se bloquea; la persona decide. Solo una regla `denegar`
configurada impide la ejecución, y sin terminal interactiva se deniega.

La lista negra evalúa **nombres**, nunca cadenas. `rm -rf` es evadible con
`rm -fr`, `rm -r -f`, `rm -f -r` o `rm --recursive --force`; por eso no se usa
para decidir, solo para avisar.

### La interfaz sí es una capacidad

**Decidido.** `interface` es uno de los 12 specs, con 22 requisitos. El que la hace
viable es *"sin terminal interactiva, degrada a salida línea a línea"*.

### Nombres de las capacidades en inglés

**Decidido.** `core`, `provider`, `tools`, `context`, `interface`, `sesiones`,
`agents`, `subagents`, `permissions`, `instructions`, `skills` y `hooks`. Los
requisitos van escritos en español con los marcadores estructurales en inglés,
porque el CLI los parsea.

### ¿Los subagentes heredan el contexto del padre?

**Resuelto (`160-subagentes`, `280-agentes-anidados`).** Contexto de mensajes
vacío + el objetivo explícito en el prompt (`task`), profundidad máxima 1,
intersección de herramientas de solo lectura (`read`, `glob`, `grep`, `skill`) y
presupuesto/límite de pasos propios. Heredan el conjunto de instrucciones
(`AGENTS.md`) ya cargadas por el padre sin cargar las suyas propias, y disparan
únicamente los hooks `preTool` y `postTool`.

### ¿El harness solo edita, o también ejecuta?

**Resuelto (`170-permisos`, `270-skills`, `290-hooks`).** `write`, `edit` y
`apply_patch` comparten la acción de permiso `edit` y pasan por el mismo gate
declarativo de permisos (`permitir | consultar | denegar`) que `shell`, `read`,
`glob`, `grep`, `subagent`, `skill`, `hook` y `external_directory`. La herramienta
de ejecución se unificó bajo el nombre `shell` en Linux, macOS y Windows.

### ¿Cuántos reintentos antes de rendirse?

**Resuelto (`020-provider`).** 3 intentos como máximo, espera inicial de 500 ms y
factor 2 entre intentos (`src/provider/retry.ts`). El spec acota el número sin
fijar la cifra; la cifra vive en el código y en el `design.md` del change.

### ¿Cómo se persisten las sesiones?

**Resuelto (`210-sesiones`).** JSONL de solo agregado en
`.harness/sesiones/<id>/`: `sesion.json` con metadatos y `eventos.jsonl` con un
registro por turno. Un corte a mitad de turno descarta ese turno, no la sesión.
La compactación agrega un registro que reemplaza el historial al reanudar.

### ¿Se pueden ramificar o buscar sesiones?

**Resuelto (`230-ramas-busqueda`).** `/rama <n>` crea una sesión nueva con el
historial hasta el turno `n` y metadatos `padre`/`desdeTurno`; la original no se
toca. `/sesiones buscar <texto>` recorre el historial del proyecto y devuelve las
sesiones con coincidencias y un fragmento. En la línea de comandos se usa
`--rama-de <id> --desde <n>`.

### ¿Cómo se cargan las instrucciones, las skills y los hooks?

**Resuelto (`260`, `270`, `280`, `290`).** El `AGENTS.md` de la raíz se carga al
arrancar (tope 32 KiB) y los `AGENTS.md` de subdirectorios se cargan de forma
diferida al explorar archivos con `read`, `write`, `edit`, `apply_patch` o `glob`
con prefijo de directorio (tope total 64 KiB). Las skills en `.opencode/skills/`
se anuncian por identificador, nombre y descripción en el prompt y su cuerpo se
entrega bajo demanda con la herramienta `skill` (protegido contra recorte). Los
hooks ejecutan comandos externos en `sessionStart`, `sessionEnd`, `preTool`,
`postTool` y `turnEnd` con códigos `0` (ok), `1` (nota/aviso) y `2` (bloqueo).

### ¿Cómo escala la gestión de contexto?

**Resuelto (`300-contexto-fino`).** Cinco umbrales progresivos sobre el límite de
presupuesto (por defecto `70%` aviso, `80%` enmascarado selectivo de salidas
`>= 1 KiB` con marcador recuperable de herramienta y argumento, `85%` poda de pasos
viejos de solo lectura sin texto del asistente, `90%` resumen solo del bloque más
antiguo y `99%` compactación completa).

## Postergadas

Se resuelven más adelante. Ninguna bloquea.
