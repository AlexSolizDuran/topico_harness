# Defensa del harness — banco de preguntas y respuestas

Material de estudio para la defensa oral. Cada pregunta tiene una **respuesta
corta** (para decir en voz alta) y, cuando hace falta, el **respaldo técnico**
(archivo, mecanismo o decisión). Las fuentes primarias son
`docs/comportamiento.md`, `AGENTS.md`, `PREGUNTAS.md`, `alcance/` y
`openspec/specs/`.

---

## 0. Pitch de 60 segundos

> Un LLM es una función texto entra, texto sale: no lee archivos, no ejecuta
> comandos y no recuerda. El **harness** es el programa que le da esas
> capacidades: el bucle, las herramientas, la gestión de contexto, los permisos,
> la memoria y los límites. En este proyecto el modelo es el motor y el harness
> es el chasis. Se implementaron 16 capacidades y 170 requisitos en TypeScript,
> con un núcleo que no depende de la interfaz, errores que vuelven al modelo como
> texto y un test por escenario del spec.

---

## 1. Contexto del proyecto: qué se construyó y cómo se resolvió

### 1.1 ¿Qué es un harness?

Es el programa que le da al modelo lo que el modelo no tiene: leer y escribir
archivos, ejecutar comandos, buscar, delegar, administrar el contexto y recordar
entre sesiones. **El modelo es el motor; el harness es el chasis.** Si solo
mandás un prompt y mostrás la respuesta, tenés un `curl`, no un agente.

### 1.2 ¿Por qué no alcanza con el modelo solo?

Porque un LLM no tiene efectos sobre el mundo. No puede abrir un archivo ni
correr un test. El harness convierte el texto del modelo en acciones y devuelve
el resultado al historial para que el modelo decida el paso siguiente.

### 1.3 ¿Qué problema concreto resuelve?

Permite completar tareas de varios pasos sobre un proyecto real: explorar,
editar, ejecutar y corregirse, con límites de seguridad y de contexto. El
objetivo no es "chatear", es **terminar la tarea** sin que el proceso muera a
mitad de camino.

### 1.4 ¿Cómo se decidió el alcance?

Con una escalera de niveles 0 a 8: one-shot, loop, contexto, subagentes,
producción, configuración, contexto fino, seguridad e integración, y memoria.
La regla fue **no construir el nivel N+1 hasta que el N duela**. El alcance
terminó en 16 capacidades y 170 requisitos, con 44 changes archivados.
Fuente: `alcance/README.md` y `alcance/plan-implementacion.md`.

### 1.5 ¿Cómo se construyó?

Spec-driven. `openspec/specs/` es el contrato; cada change implementa contra esos
requisitos, se valida con `openspec validate --strict` y se archiva. Orden
práctico: primero `provider` (nivel 0), después `nucleo`, `tools`, `interface` y
`context`. `provider` va antes que `nucleo` porque el núcleo necesita una
interfaz contra la cual probarse.

### 1.6 ¿Cuál es la decisión arquitectónica central?

`src/core/` **no importa nada de `src/interface/`**. Recibe el proveedor y el
registro de herramientas por parámetro y devuelve un flujo de eventos. Eso hace
reversible la decisión terminal↔web, permite testear el núcleo sin UI y está
verificado por un test que falla si aparece ese import.
Fuente: regla 1 de `AGENTS.md`.

### 1.7 ¿Qué se descartó?

- **Desktop**: bundle, firma y updates.
- **Web**: autenticación del daemon y una capa de red que multiplica el debugging.
- **Base de datos**: el estado vive en memoria y la persistencia es JSONL.
- **Clasificar comandos por categoría de efecto**: alcanza con catálogo + lista
  negra como etiquetas de riesgo.
- **Worktrees, plugins JS de hooks, MCP remoto y sincronización de memoria**:
  postergados explícitamente en `PREGUNTAS.md`.

### 1.8 ¿Cómo se verificó?

Un test por escenario del spec, con el nombre literal del escenario. `npm run
check` encadena lint, typecheck y tests; hoy pasa con **628 tests**. Los tests no
necesitan credencial real: hay un provider simulado y servidores LSP/MCP falsos
locales.

### 1.9 ¿Qué queda afuera o como riesgo?

Windows está cubierto por tests unitarios pero todavía no corrió en CI sobre
Windows. La persistencia asume un **escritor único** por proyecto (no hay bloqueo
entre procesos). El transporte MCP es solo local.

---

## 2. Gestión de contexto (capacidad `context`)

### 2.1 ¿Por qué hace falta gestionar el contexto?

Porque la ventana del modelo es finita y cada paso del bucle agrega historial.
Sin gestión, el harness se rompe a los pocos viajes. La capacidad `context`
permite trabajar una hora sin degradarse.

### 2.2 ¿Cómo se define el presupuesto?

`límite = ventanaContexto × 0.8`. El 20% restante es **margen intocable**: nunca
se usa. Con 128.000 tokens de ventana, el límite real es ~102.400.
Fuente: `src/context/budget.ts:1-3`.

### 2.3 ¿Cómo se cuentan los tokens?

Se usa `entrada + salida` que reporta el provider; si no hay dato, se estima
`caracteres / 4` redondeando hacia arriba. Cambiar de modelo resetea el conteo y
recalcula el presupuesto con la nueva ventana.
Fuente: `src/context/tokens.ts`.

### 2.4 ¿Cuáles son las cinco etapas?

Umbrales progresivos y configurables sobre el límite:

| Etapa | Umbral | Qué hace |
|---|---|---|
| Aviso | 70% | Informa, no modifica el historial |
| Enmascarado | 80% | Reemplaza salidas viejas de tools ≥ 1 KiB por un marcador recuperable (herramienta + argumento) |
| Poda | 85% | Elimina pasos viejos de solo lectura que no aportaron texto del asistente |
| Resumen | 90% | Resume solo el bloque más antiguo |
| Compactación | 99% | Compacta el historial completo |

Se detiene en la primera etapa que baja del umbral. Fuente:
`src/context/pipeline.ts:81-198`; `PREGUNTAS.md`.

### 2.5 ¿Qué pasa dentro del turno, antes de cada envío?

`prepararHistorialPaso`: si no está cerca del límite, no toca nada; si está
cerca, recorta resultados viejos de tools; si aun así supera el límite, devuelve
error y el paso **falla antes de enviar**. El pipeline de cinco etapas corre al
**final** del turno. Fuente: `docs/comportamiento.md` §6.1-6.2.

### 2.6 ¿Cómo es la compactación?

Es determinista y local, **sin llamada al modelo**. Conserva el prompt de
sistema, descarta resúmenes previos y convierte los turnos viejos en un único
mensaje `system` con el encabezado
`[RESUMEN GENERADO AUTOMÁTICAMENTE - NO SON HECHOS VERIFICADOS]`. Conserva 2
turnos recientes y luego 1; máximo 8 iteraciones. Valida la atomicidad antes de
devolver. Fuente: `src/context/compaction.ts`; `pipeline.ts:34-79`.

### 2.7 ¿Cuáles son las tres reglas que no se rompen?

1. El prompt del sistema **nunca** se descarta.
2. El historial **nunca** se corta entre una herramienta y su respuesta.
3. El resumen se marca **siempre** como generado automáticamente.

Fuente: `openspec/specs/context/spec.md:154-200`.

### 2.8 ¿Un subagente comparte el presupuesto del padre?

No. Tiene presupuesto, pasos y modelo propios, calculados sobre la ventana de su
modelo. Si el pedido solo ya excede su presupuesto, devuelve error.
Fuente: spec `context`; `PREGUNTAS.md`.

### 2.9 ¿Qué pasa si después de compactar sigue excediendo?

Se avisa que no se enviarán más peticiones hasta reducir el historial. No se
recorta en silencio ni se manda igual. Fuente: `docs/comportamiento.md` §6.3.

---

## 3. Shell

### 3.1 ¿Por qué una sola tool `shell`?

Porque se unificó la ejecución bajo el mismo nombre en Linux, macOS y Windows.
Cambia el mecanismo por plataforma, no la herramienta que ve el modelo: Unix usa
`exec`; Windows, PowerShell. Fuente: `PREGUNTAS.md`.

### 3.2 ¿Cómo analiza la línea?

`analizarLinea` la recorre **una sola vez** respetando comillas y escapes, y
separa segmentos, redirecciones y composición. No usa un parser externo.
Fuente: `src/tools/shell.ts`.

### 3.3 ¿Cómo decide el riesgo?

Tres acciones:

- `shell` si es una invocación simple;
- `shell_compuesto` si compone con `;`, `&&`, `||` o `|`;
- `shell_redireccion` si redirige a un archivo.

Una línea compuesta, un intérprete con bandera de código (`bash -c`, `node -e`,
`python3 -c`), `$()` o backticks piden **aprobación obligatoria**.
Fuente: `resolverAccion`; `docs/comportamiento.md` §5.1.

### 3.4 ¿Qué son el catálogo y la lista negra?

Son **etiquetas de riesgo, no un muro**. Si el comando está en la lista negra o
fuera del catálogo conocido, no se rechaza: se eleva a aprobación obligatoria. La
persona decide. Solo una regla `denegar` configurada impide la ejecución.
Fuente: decisión cerrada 5 de `AGENTS.md`.

### 3.5 ¿Por qué la lista negra evalúa nombres y no flags?

Porque evaluar combinaciones de flags es evadible: `rm -rf` se escribe `rm -fr`,
`rm -r -f`, `rm -f -r` o `rm --recursive --force`. Por eso se usa para **avisar**,
no para decidir. Verificado en GNU coreutils 9.7. Fuente: `PREGUNTAS.md`.

### 3.6 ¿Y en Windows?

Allowlist + PowerShell (`-NoProfile -NonInteractive -Command`). No hay lista negra
porque una lista por nombre no aguanta los alias de PowerShell. La composición
pide aprobación obligatoria. Fuente: `src/tools/shell.ts:63-88`.

### 3.7 ¿Qué pasa con redirecciones y heredocs?

`2>&1`, `n>&m`, `n>&-` y `/dev/null` siguen siendo invocación simple. Un heredoc,
herestring o sustitución de proceso pide aprobación obligatoria **sin validar el
contenido**. Fuente: `docs/comportamiento.md` §5.1.

### 3.8 ¿Cómo se manejan el directorio y el aislamiento?

El `directorio` se resuelve y se verifica que exista; fuera del proyecto o dentro
de `.harness` pide aprobación. El resultado agrega
`Aislamiento: activo (<mecanismo>)` o
`Aislamiento: no disponible — <motivo>`, y la primera degradación avisa
visiblemente. Fuente: `docs/comportamiento.md` §5.1; spec `sandbox`.

### 3.9 ¿Cómo se entrega la salida?

Como **cola** (lo último), truncada, con marcador. Un código de salida distinto de
0 se informa junto con la salida; no se tira excepción. Unix usa `maxBuffer` de
10 MB. Fuente: spec `tools`; `docs/comportamiento.md` §5.1.

---

## 4. Herramientas: cuántas hay, cuáles leen/escriben y qué hace cada una

### 4.1 ¿Cuántas herramientas hay?

Depende de cómo se cuente:

| Conjunto | Cantidad | Cuáles |
|---|---|---|
| Núcleo fijo de archivos/ejecución | 7 | `read`, `write`, `edit`, `apply_patch`, `glob`, `grep`, `shell` |
| Al arrancar, sin MCP | 11 | las 7 + `lsp`, `task`, `task_status`, `task_cancel` |
| Con skills descubiertas | 12 | las 11 + `skill` |
| MCP | dinámico | una entrada `<servidor>_<herramienta>` por herramienta anunciada |

Fuente: `src/tools/catalog.ts`; `src/app.ts:203-303`.

### 4.2 ¿Cuáles son de lectura y cuáles de escritura?

**Solo lectura:** `read`, `glob`, `grep`, `lsp`, `task_status` y `skill`. El
conjunto formal de solo lectura para subagentes es
`read`, `glob`, `grep`, `skill`, `lsp`. Fuente: `src/agents/definiciones.ts:5-11`.

**Escritura o mutación:** `write`, `edit` y `apply_patch` (acción `edit`) y
`shell` (puede mutar por comando o redirección, con gate de riesgo).

**Orquestación:** `task` y `task_cancel`.

**Externa:** las herramientas MCP, clasificadas con acción `mcp`.

### 4.3 Tabla por acción de permiso

| Acción | Herramientas |
|---|---|
| `read` | `read`, `glob`, `grep`, `task_status` |
| `edit` | `write`, `edit`, `apply_patch` |
| `shell` / `shell_compuesto` / `shell_redireccion` | `shell` |
| `lsp` | `lsp` |
| `skill` | `skill` |
| `subagent` | `task`, `task_cancel` |
| `mcp` | herramientas externas |

### 4.4 ¿Qué hace cada herramienta?

#### `read`

- **Qué hace:** lee un archivo completo o un tramo de líneas.
- **Argumentos:** `ruta` (obligatorio), `inicio` y `fin` (1-indexados,
  inclusive).
- **Permiso:** `read`. **Paralelo:** sí.
- **Bordes:** trunca el contenido; una ruta fuera del proyecto o sensible pide
  aprobación obligatoria.
- Fuente: `src/tools/read.ts`.

#### `write`

- **Qué hace:** crea un archivo o lo sobrescribe por completo.
- **Argumentos:** `ruta` y `contenido`.
- **Permiso:** `edit`. **Paralelo:** no.
- **Bordes:** crea directorios padres; informa la cantidad de caracteres
  escritos.
- Fuente: `src/tools/write.ts`.

#### `edit`

- **Qué hace:** reemplaza **una única ocurrencia exacta** de texto.
- **Argumentos:** `ruta`, `buscar`, `reemplazar`.
- **Permiso:** `edit`. **Paralelo:** no.
- **Bordes:** falla si `buscar` está vacío, si no aparece o si aparece más de una
  vez; tolera LF/CRLF y restaura el EOL dominante.
- Fuente: `src/tools/edit.ts`.

#### `apply_patch`

- **Qué hace:** aplica un parche multiarchivo con bloques `Add File`, `Update
  File` y `Delete File` entre `*** Begin Patch` y `*** End Patch`.
- **Argumentos:** `patch`.
- **Permiso:** `edit`. **Paralelo:** no.
- **Bordes:** valida **todo** el parche antes de escribir; una actualización exige
  coincidencia única; trunca el resumen.
- Fuente: `src/tools/patch.ts`.

#### `glob`

- **Qué hace:** encuentra rutas de archivos que coinciden con un patrón glob.
- **Argumentos:** `patron`.
- **Permiso:** `glob`. **Paralelo:** sí.
- **Bordes:** devuelve solo archivos, en JSON ordenado; ignora `node_modules`,
  `.git`, `.vitest`, `coverage`, `dist`, `.harness` y archivos de entorno; un
  patrón con `..` devuelve `[]`.
- Fuente: `src/tools/glob.ts`.

#### `grep`

- **Qué hace:** busca una cadena literal dentro de los archivos y devuelve
  `ruta:línea: texto`.
- **Argumentos:** `cadena`.
- **Permiso:** `grep`. **Paralelo:** sí.
- **Bordes:** omite archivos ilegibles sin frenar la búsqueda; ignora los mismos
  directorios que `glob`; trunca la salida.
- Fuente: `src/tools/grep.ts`.

#### `shell`

- **Qué hace:** ejecuta una invocación simple de comando.
- **Argumentos:** `comando` y `directorio` opcional.
- **Permiso:** `shell`, `shell_compuesto` o `shell_redireccion` según el caso.
  **Paralelo:** no.
- **Bordes:** lo riesgoso pide aprobación obligatoria; entrega la salida como cola
  y agrega la línea de aislamiento.
- Fuente: `src/tools/shell.ts`.

#### `lsp`

- **Qué hace:** consulta información semántica de código.
- **Argumentos:** `operacion` (`definition`, `references`, `documentSymbols`,
  `workspaceSymbols`, `hover`, `diagnostics`), `ruta`, `linea`, `caracter`,
  `simbolo`.
- **Permiso:** `lsp`. **Paralelo:** sí. Es de solo lectura.
- **Bordes:** falla como texto; después de `edit`, `write` o `apply_patch` el
  catálogo agrega los diagnósticos del archivo afectado.
- Fuente: `src/lsp/herramienta.ts`.

#### `task`

- **Qué hace:** delega una investigación acotada a un subagente con contexto
  aislado.
- **Argumentos:** `agent`, `prompt` y `background` opcional.
- **Permiso:** `subagent`. **Paralelo:** no.
- **Bordes:** profundidad máxima 1; el subagente solo usa la intersección de solo
  lectura; con `background: true` devuelve un id para consultarlo.
- Fuente: `src/subagents/herramienta.ts`.

#### `task_status`

- **Qué hace:** consulta el estado de una tarea en background o lista todas.
- **Argumentos:** `id` opcional.
- **Permiso:** `read`. **Paralelo:** sí.
- Fuente: `src/subagents/herramientas-background.ts`.

#### `task_cancel`

- **Qué hace:** cancela una tarea en background que todavía está en curso.
- **Argumentos:** `id`.
- **Permiso:** `subagent`. **Paralelo:** no.
- **Bordes:** si la tarea ya terminó, lo informa; no falla.
- Fuente: `src/subagents/herramientas-background.ts`.

#### `skill`

- **Qué hace:** carga el cuerpo completo de una skill del catálogo para seguir sus
  instrucciones paso a paso.
- **Argumentos:** `id`.
- **Permiso:** `skill`. **Paralelo:** no declara `admiteParalelo`, así que va
  serial.
- **Bordes:** devuelve el directorio base y los archivos de apoyo; el cuerpo está
  protegido contra recorte por el contexto.
- Fuente: `src/tools/skill.ts`.

#### Herramientas MCP (`<servidor>_<herramienta>`)

- **Qué hace:** ejecuta una herramienta externa de un servidor MCP.
- **Argumentos:** los que declare el servidor; se validan contra su JSON Schema.
- **Permiso:** `mcp`. **Paralelo:** sí.
- **Bordes:** nombre con prefijo del servidor; resultado como texto truncado y
  sanitizado; si el servidor declara riesgo, aprobación obligatoria.
- Fuente: `src/mcp/herramienta.ts`.

### 4.5 ¿Cuántas herramientas ve un subagente?

La intersección entre lo que declara y el conjunto de solo lectura: como máximo
`read`, `glob`, `grep`, `skill`, `lsp`. Nunca `task`, así que no puede anidar
subagentes. Fuente: `src/subagents/ejecutor.ts:168-169`.

---

## 5. MCP

### 5.1 ¿Qué es MCP en este harness?

Un mecanismo para declarar **servidores locales** que exponen herramientas
externas. El harness las traduce a entradas del catálogo y el modelo las usa como
cualquier otra herramienta. Fuente: spec `mcp` (6 requisitos).

### 5.2 ¿Cómo se declaran y conectan?

En la configuración: `id`, `comando`, `args` y `env`. `env` es una **lista de
nombres**, nunca valores literales: un secreto literal se rechaza al validar. La
conexión es **bajo demanda**, la primera vez que el modelo usa una herramienta del
servidor. Fuente: `src/mcp/gestor.ts:25-88`.

### 5.3 ¿Cómo se nombran y ordenan?

`<servidor>_<herramienta>`. Se agregan **al final** del catálogo, sin reordenar
las existentes. Si no hay servidores conectados, el modelo no recibe ninguna
herramienta externa. Fuente: `src/mcp/herramienta.ts:35-47`.

### 5.4 ¿Cómo se validan los argumentos y qué devuelven?

Contra el JSON Schema real que declara el servidor: `type`, `properties`,
`required`, `enum`, `items`, `additionalProperties`. Si no cumple, vuelve error
como texto y **no se ejecuta**. El resultado se devuelve como texto, truncado
(cola, 64 KiB por defecto) y sanitizado contra credenciales.
Fuente: `src/mcp/gestor.ts:108-153`.

### 5.5 ¿Cómo aplican permisos?

Acción `mcp`, recurso `<servidor>/<herramienta>`. Sin regla aplicable →
**consultar**. `permitir` → ejecuta sin preguntar. `denegar` → no ejecuta y el
rechazo vuelve como texto. Si el servidor declara `riesgoso` o `motivoRiesgo`, se
eleva a **aprobación obligatoria**. Sin TTY no se ejecuta lo que requiere
aprobación. Fuente: spec `mcp`:112-138.

### 5.6 ¿Qué pasa si un servidor no arranca, se cae o vence el timeout?

El fallo vuelve como texto y **la sesión sigue**. No quedan procesos huérfanos:
`cerrar()` mata todos. La conexión se puede reintentar en un turno posterior.
Fuente: `src/mcp/gestor.ts:90-163`.

### 5.7 ¿Un agente ve todos los servidores?

No. Solo ve los que **declara** en su definición; los demás no se tocan. La
conexión es idempotente y se filtra por `denegar` antes de anunciar.
Fuente: `src/app.ts:470-505`; spec `mcp`:139.

### 5.8 ¿Qué quedó fuera de MCP?

El transporte remoto: solo se especifican servidores locales declarados en la
configuración. Fuente: `PREGUNTAS.md`.

---

## 6. Glosario de nombres técnicos del harness

### Fundamentos

| Término | Qué es |
|---|---|
| **Harness** | El programa que le da capacidades al modelo: bucle, tools, contexto, permisos, memoria. |
| **Modelo / LLM** | La función texto→texto que razona; no tiene efectos por sí sola. |
| **Provider** | La interfaz con el modelo. El SDK vive solo en el adaptador. |
| **Adaptador** | La implementación concreta de `Proveedor`; hoy `openai-compatible` (cubre OpenRouter). |
| **Agente** | Perfil declarativo con nombre, modo, herramientas, prompt y modelo. |
| **Subagente** | Agente lanzado por otro con contexto aislado y solo lectura. |
| **Capacidad** | Una de las 16 áreas del contrato: `core`, `provider`, `tools`, etc. |
| **Requisito** | Frase normativa (SHALL / SHALL NOT) dentro de un spec. |
| **Escenario** | Caso WHEN/THEN que concreta un requisito y se convierte en test. |
| **Spec** | La fuente de verdad del comportamiento; vive en `openspec/specs/`. |
| **Change** | Unidad de trabajo de OpenSpec que implementa o modifica specs. |
| **Delta spec** | El cambio propuesto a un spec dentro de un change. |
| **OpenSpec** | La herramienta y el flujo de trabajo spec-driven del proyecto. |
| **`skip_specs`** | Marca de un change que no introduce comportamiento nuevo. |

### Bucle y ejecución

| Término | Qué es |
|---|---|
| **Turno** | Una petición completa del usuario, de principio a fin. |
| **Paso** | Una iteración del bucle: consultar al modelo y, si pide tools, ejecutarlas. |
| **Iteración** | Cada vuelta del `while` del turno. |
| **Tanda / batch** | Grupo de llamadas consecutivas que admiten paralelo y se ejecutan juntas. |
| **Llamada a herramienta** | Pedido del modelo con nombre y argumentos (`tool_call`). |
| **Despacho / dispatch** | Resolver, validar, autorizar y ejecutar una llamada. |
| **Registro** | `RegistroHerramientas`: mapa nombre → `{esquema, ejecutar}`. Es datos, no un `switch`. |
| **Historial** | La lista de mensajes `system`, `user`, `assistant` y `tool`. |
| **Atomicidad del historial** | Cada mensaje `tool` debe tener un `assistant` previo que pidió esa llamada. |
| **`AbortController`** | Mecanismo de cancelación; aborta el turno, la aprobación y las tareas background. |
| **Detección de bucles** | Bloquea la tercera repetición consecutiva idéntica de una llamada, sin abortar el turno. |
| **Límite de pasos** | Tope de 25 pasos por turno; al llegar, cierra con aviso. |

### Provider y modelo

| Término | Qué es |
|---|---|
| **Streaming** | La respuesta llega por partes (`texto` en deltas). |
| **SSE** | Server-Sent Events, el formato de stream de OpenAI/OpenRouter. |
| **Evento** | Unidad que emite el provider o el turno (`texto`, `solicitud_herramienta`, `fin`). |
| **Reintento / backoff** | Hasta 3 intentos, 500 ms inicial y factor 2, solo para errores transitorios. |
| **Error transitorio** | 429, 5xx, `ECONNRESET`, `ETIMEDOUT`. |
| **Token** | Unidad de conteo del modelo; `entrada + salida`. |
| **Ventana de contexto** | Máximo de tokens que el modelo puede recibir. |
| **`maxTokensSalida`** | Tope de `max_tokens` de la respuesta. |
| **Credencial** | La API key; se lee del entorno y se redacta de errores y resultados. |
| **Sanitización / redacción** | Reemplazar credenciales por `[REDACTADO]` antes de mostrar o persistir. |
| **Prompt de sistema** | Las instrucciones base; nunca se descarta al compactar. |

### Herramientas y seguridad

| Término | Qué es |
|---|---|
| **Esquema / schema** | La definición JSON de los argumentos de una tool. |
| **Validación** | Comprobar los argumentos contra el esquema antes de ejecutar. |
| **Acción de permiso** | La categoría con la que se autoriza una tool (`read`, `edit`, `shell`, `mcp`, etc.). |
| **Recurso** | El objeto concreto que se autoriza (ruta, comando, `<servidor>/<herramienta>`). |
| **Catálogo** | Lista de comandos conocidos por plataforma; etiqueta de riesgo, no muro. |
| **Lista negra** | Nombres de comandos riesgosos en Unix; eleva a aprobación obligatoria. |
| **Allowlist** | Lista permitida en Windows; lo demás pide aprobación. |
| **Aprobación obligatoria** | Decisión que ninguna regla `permitir` ni aprobación guardada puede saltar. |
| **Composición** | Encadenar comandos con `;`, `&&`, `||` o `|`. |
| **Redirección** | Enviar la salida o entrada a un archivo o descriptor. |
| **Heredoc / herestring** | Bloques de entrada embebidos (`<<`, `<<<`); piden aprobación sin validar contenido. |
| **Sustitución de proceso** | `<(comando)` o `>(comando)`; pide aprobación. |
| **Intérprete con bandera de código** | `bash -c`, `node -e`, `python3 -c`, etc.; ejecutan código arbitrario. |
| **Truncado** | Cortar contenido a un máximo con un marcador visible. |
| **Cola / tail** | Entregar solo lo último de una salida larga. |
| **`realpath`** | Resolver enlaces simbólicos para que un symlink no escape del proyecto. |
| **Path traversal** | Salir del proyecto con `..`; se clasifica como `external_directory`. |
| **Sandbox / aislamiento** | Ejecutar una herramienta dentro de un mecanismo del SO (`bwrap`, `sandbox-exec`). |
| **Degradación** | Informar que no hay aislamiento, en vez de fingir que lo hay. |

### Contexto

| Término | Qué es |
|---|---|
| **Presupuesto** | `ventana × 0.8`; el 20% restante es margen intocable. |
| **Umbral** | Punto porcentual que dispara una etapa (70/80/85/90/99). |
| **Enmascarado** | Reemplazar salidas viejas de tools por un marcador recuperable. |
| **Poda** | Eliminar pasos viejos de solo lectura que no aportaron texto del asistente. |
| **Resumen** | Sintetizar el bloque más antiguo del historial. |
| **Compactación** | Reemplazar turnos viejos por un resumen y conservar los recientes. |
| **Recordatorio de sistema** | Mensaje inyectado en un evento del turno para reforzar una regla. |

### Permisos, sesiones y extensiones

| Término | Qué es |
|---|---|
| **Portero / gate** | El componente que evalúa reglas y decide `permitir`, `consultar` o `denegar`. |
| **Regla ordenada** | `{acción, recurso, efecto}`; la última que coincide gana. |
| **Efecto** | `permitir`, `consultar` o `denegar`. |
| **Aprobación guardada** | Regla persistida en `.harness/approvals.json` tras un `siempre`. |
| **`una_vez` / `siempre` / `denegar`** | Las tres decisiones posibles ante una aprobación. |
| **TTY** | Terminal interactiva; sin TTY, lo que requiere aprobación se deniega. |
| **Hook** | Comando externo en `sessionStart`, `sessionEnd`, `preTool`, `postTool` o `turnEnd`. |
| **Skill** | Instrucciones en `.opencode/skills/` que se anuncian y se cargan bajo demanda. |
| **Instrucciones** | `AGENTS.md` de la raíz (al arrancar) y de subdirectorios (al explorar). |
| **Memoria** | Hechos del proyecto que sobreviven entre sesiones; índice + detalle. |
| **MCP** | Protocolo de servidores locales que exponen herramientas externas. |
| **LSP** | Language Server Protocol; operaciones semánticas y diagnósticos. |
| **JSON-RPC** | El protocolo de mensajes que usa LSP (`Content-Length` + JSON). |
| **Sesión** | Un historial persistido en `.harness/sesiones/<id>/`. |
| **JSONL** | Archivo de solo agregado con un JSON por línea. |
| **Rama** | Sesión nueva creada a partir del historial hasta un turno anterior. |
| **Tarea background** | Subagente que corre sin bloquear el turno padre. |
| **Profundidad 1** | Un subagente no puede lanzar otro subagente. |
| **Intersección de solo lectura** | Las tools que puede usar un subagente: `read`, `glob`, `grep`, `skill`, `lsp`. |

### Arquitectura y stack

| Término | Qué es |
|---|---|
| **Composition root** | `construirHarness` en `src/app.ts`: arma todas las piezas y las conecta. |
| **Dirección de dependencias** | Las flechas van hacia abajo; `core/` no importa `interface/`. |
| **ESM** | Módulos nativos de JavaScript (`"type": "module"`). |
| **`nodenext`** | Modo de TypeScript que exige extensión `.js` en imports relativos. |
| **Ink / React** | La librería de interfaz de terminal. |
| **zod** | La librería de validación de esquemas. |
| **Biome** | Lint y formato. |
| **Vitest** | El framework de tests. |
| **`npm run check`** | Lint + typecheck + tests. |
| **TUI** | Interfaz de terminal interactiva (Ink). |
| **Modo plano** | Salida línea a línea cuando no hay TTY. |
| **Snapshot** | Instantánea inmutable del estado visual que la interfaz traduce a líneas o componentes. |
| **OpenRouter** | El provider de la v1, con API compatible con OpenAI. |
| **`bwrap`** | `bubblewrap`, el mecanismo de aislamiento en Linux. |
| **`sandbox-exec`** | El mecanismo de aislamiento en macOS. |
| **PowerShell** | El shell con allowlist que se usa en Windows. |

### Siglas

| Sigla | Significado |
|---|---|
| **LLM** | Large Language Model; el modelo de lenguaje. |
| **API** | Interfaz de programación con la que se habla al provider. |
| **SDK** | Kit de desarrollo; vive solo dentro del adaptador. |
| **ESM** | ECMAScript Modules; módulos nativos de JavaScript. |
| **TTY** | Teletype; una terminal interactiva. |
| **SSE** | Server-Sent Events; el stream de OpenAI/OpenRouter. |
| **JSON-RPC** | Protocolo de mensajes JSON que usa LSP. |
| **LSP** | Language Server Protocol. |
| **MCP** | Model Context Protocol. |
| **EOL** | End of Line; el fin de línea de un archivo. |
| **LF / CRLF** | Los dos estilos de fin de línea (`\n` y `\r\n`). |
| **FD** | File Descriptor; descriptor de archivo (`2>&1`, `n>&m`). |
| **JSONL** | JSON Lines; un JSON por línea, de solo agregado. |
| **UI / TUI** | Interfaz de usuario / interfaz de usuario de terminal. |
| **CI** | Integración continua. |

---

## 7. Preguntas trampa

**¿Qué pasa si el modelo pide una tool que no existe?**
Vuelve un `ERROR:` como texto; el turno no se aborta y el modelo puede corregirse.

**¿Qué pasa si los argumentos no validan?**
Igual: error como texto, sin ejecutar.

**¿Qué pasa si el usuario cancela a mitad de una tanda?**
Se aborta el turno; las llamadas sin resultado se completan con un error de
cancelación para no romper la atomicidad del historial.

**¿Qué pasa si el modelo repite la misma llamada tres veces?**
El detector de bucles la bloquea con un error de texto; no aborta el turno.

**¿Se puede saltar una aprobación obligatoria con `siempre`?**
No. `siempre` se normaliza a `una_vez` y no persiste nada. Tampoco la salta una
regla `permitir`.

**¿Qué pasa sin terminal interactiva?**
Se degrada a salida línea a línea. Lo que requiere aprobación se deniega.

**¿El resumen de contexto llama al modelo?**
No. Es determinista y local: extrae `archivo:línea`, errores y menciones de
"corregido", y arrastra hechos de resúmenes anteriores.

**¿La memoria entra en el presupuesto?**
Sí. Sus tokens se suman al prompt y a la medición previa al envío. Si no cabe, el
envío se frena con un aviso; no se recorta en silencio.

**¿Qué pasa si un servidor MCP se cae?**
El fallo vuelve como texto, la sesión sigue y se puede reintentar en otro turno.

**¿Por qué no hay base de datos?**
El estado vive en memoria durante el turno y las sesiones son JSONL de solo
agregado. Menos superficie, portable y auditable. Un corte a mitad de turno
descarta ese turno, no la sesión.

---

## 8. Cómo repasar en 10 minutos

1. Decir el pitch de 60 segundos.
2. Explicar la dirección de dependencias y por qué importa.
3. Contar el turno: paso, tanda, despacho, error como texto, límite 25.
4. Explicar las cinco etapas de contexto con sus porcentajes.
5. Diferenciar catálogo, lista negra y aprobación obligatoria.
6. Nombrar las 7 tools del núcleo y separar lectura de escritura.
7. Cerrar con MCP: declaración, conexión bajo demanda, permisos y fallo aislado.
