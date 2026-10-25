# Preguntas y decisiones

Lo que quedó por decidir y el registro de lo ya decidido. Las 8 capacidades de
`openspec/specs/` están implementadas; ninguna decisión abierta bloquea el
funcionamiento actual.

## Resueltas

Se documentan acá porque `alcance/decisiones-abiertas.md` es el registro original
y estas decisiones ya se escribieron en los specs.

### El provider de la v1

**Resuelto (`020-provider`).** OpenRouter, por su API compatible con OpenAI y su
catálogo de modelos. Ollama queda como alternativa local. El spec de `provider`
es agnóstico a propósito: ninguno de sus requisitos nombra un proveedor.

### Plataformas: Linux, macOS y Windows

**Decidido.** Invertido lo que decía `alcance/`, que las excluía. La CI en los tres
sistemas se monta con un archivo de 25 líneas, y la ejecución de comandos en
Windows se resolvió con PowerShell y una allowlist (`120-shell-windows`).

### Catálogo de comandos y lista negra

**Decidido.** Un catálogo por plataforma, y encima una lista negra por nombre
completo en Unix. Se descartó la clasificación por categoría de efecto: la
allowlist de Windows y la lista negra de Unix alcanzan.

La lista negra bloquea **nombres**, nunca cadenas. `rm -rf` es evadible con
`rm -fr`, `rm -r -f`, `rm -f -r` o `rm --recursive --force`.

### La interfaz sí es una capacidad

**Decidido.** `interface` es uno de los 8 specs, con 17 requisitos. El que la hace
viable es *"sin terminal interactiva, degrada a salida línea a línea"*.

### Nombres de las capacidades en inglés

**Decidido.** `core`, `provider`, `tools`, `context`, `interface`, `agents`,
`subagents` y `permissions`. Los requisitos van escritos en español con los
marcadores estructurales en inglés, porque el CLI los parsea.

### ¿Los subagentes heredan el contexto del padre?

**Resuelto (`160-subagentes`).** Contexto vacío + el objetivo explícito en el
prompt (`task`), profundidad máxima 1, intersección de herramientas de solo
lectura y presupuesto/límite de pasos propios. Es lo que hace que el padre no se
infle.

### ¿El harness solo edita, o también ejecuta?

**Resuelto (`170-permisos`).** `write` y `edit` comparten la acción de permiso
`edit` y pasan por el mismo gate declarativo de permisos
(`permitir | consultar | denegar`) que `shell`, `read`, `glob`, `grep`,
`subagent` y `external_directory`. La herramienta de ejecución se unificó bajo el
nombre `shell` en Linux, macOS y Windows.

### ¿Cuántos reintentos antes de rendirse?

**Resuelto (`020-provider`).** 3 intentos como máximo, espera inicial de 500 ms y
factor 2 entre intentos (`src/provider/retry.ts`). El spec acota el número sin
fijar la cifra; la cifra vive en el código y en el `design.md` del change.

## Postergadas

Se resuelven más adelante. Ninguna bloquea.

### ¿Cómo se persisten las sesiones?

**Nivel 4.** Si no hay persistencia, cerrar el harness pierde la conversación
entera. Hoy eso es aceptable: el requisito `core` de cancelación deja el estado
consistente, no durable.

| Formato | A favor | En contra |
|---|---|---|
| JSONL en `.harness/` | Append-only, recuperable | Hay que reconstruir en memoria |
| JSON completo | Simple | Un corte de escritura pierde todo |
| SQLite | Consultable, transaccional | Un día de setup |

**Recomendación:** JSONL. Append-only significa que un corte a mitad de turno
pierde ese turno, no la sesión.
