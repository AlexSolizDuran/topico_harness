# Comportamiento de la aplicación

Documento derivado exclusivamente de `src/` (65 archivos: 62 `.ts` y 3 `.tsx`,
~10.500 líneas). Describe qué hace el harness y cómo se comporta en cada caso
borde, sin referencias a specs, tests ni documentación externa.

---

## 1. Arranque

`src/main.ts` es el único entrypoint (`bin` del paquete). Secuencia:

1. `parsearArgumentos(process.argv.slice(2))` (`args.ts:42`).
2. `--help` / `-h` imprime `AYUDA` y sale con `0`.
3. `--dir` se valida con `statSync(...).isDirectory()`; si no existe → `ERROR: el
   directorio no existe: <ruta>` y código `1`.
4. El pedido es `args.pedido`; si está vacío y `stdin` no es TTY, lee `stdin`
   completo y lo trimea. Si tampoco hay nada, el pedido es `''`.
5. `interactivo = stdout.isTTY && stdin.isTTY && !pedido`.
6. `prepararSesion(args, directorio, interactivo)`:
   - valida `--rama-de` (exige `--desde` entero ≥ 0; prohíbe `--sin-sesion`);
   - llama `construirHarness` y descarta todo menos `sesion`;
   - aplica `--modelo` con `cambiarModelo` y `--agente` con `cambiarAgente`.
7. `ejecutarPedido`:
   - sin TTY imprime `[Sesión: <id>]` antes de empezar;
   - si es interactivo y no hay pedido, monta la TUI (`render.tsx`);
   - si hay pedido, ejecuta en plano con `enviarMensaje`;
   - si no hay pedido ni TTY, escribe `No se recibió ningún pedido...` y sale `1`.
8. Código de salida: `1` si el último turno fue `fallido`, `0` en cualquier otro caso.

Cualquier excepción de `main` se imprime como `ERROR: <mensaje>` y deja
`process.exitCode = 1`; nunca se muestra un stack trace.

### Argumentos (`args.ts:1`)

| Argumento | Efecto |
|---|---|
| `--dir <ruta>` | proyecto sobre el que trabaja el harness |
| `--modelo <prov/modelo>` | modelo inicial; se aplica después de construir |
| `--agente <nombre>` | agente primario inicial |
| `--continuar` | reanuda la última sesión del proyecto |
| `--sesion <id>` | reanuda la sesión indicada |
| `--rama-de <id>` + `--desde <n>` | crea una rama desde el turno `n` |
| `--sin-sesion` | desactiva guardado y reanudación |
| `-h`, `--help` | ayuda |
| `--` | todo lo siguiente es pedido, no flags |

`--flag=valor` y `--flag valor` son equivalentes (`leerValor`). `--desde` inválido
se guarda como `NaN` y falla en la validación de `prepararSesion`.

---

## 2. Cableado (`app.ts:78`)

`construirHarness` es el composition root. Orden de ensamblaje y por qué:

| Paso | Produce | Consume |
|---|---|---|
| 1 | `directorioProyecto` = opción o `cwd` | — |
| 2 | `RegistroHerramientas` (catálogo por defecto) | directorio |
| 3 | `provider` + `modeloActivo` + `ventanaContexto` + credenciales | configuración |
| 4 | `gestorTareas` y huecos `agentesLista` / `sesionRef` | — |
| 5 | tools `task`, `task_status`, `task_cancel` | catálogo, tareas |
| 6 | agentes validados y agente por defecto | catálogo completo, modelos |
| 7 | `almacen` y `sesionInicial` | config, flags |
| 8 | `SesionInteractiva` | todo lo anterior |
| 9 | override de `--agente` | instancia de sesión |

Reglas del cableado:

- Si le inyectan `proveedor`, no lee configuración; si no, `cargarConfig` +
  `resolverProveedor` + `listarModelos`.
- El catálogo por defecto registra `read`, `write`, `edit`, `apply_patch`, `glob`,
  `grep` y `shell` (según plataforma), cada uno validado por
  `registrarHerramientaConValidacion` (esquema no vacío, `accionPermiso` y
  `obtenerRecurso` obligatorios).
- Las tools de delegación solo se registran si el catálogo no fue inyectado y no
  contiene ya `task`.
- Los agentes se cargan **después** de registrar `task`, porque
  `crearAgentesPorDefecto` copia el catálogo en ese momento y valida cada
  definición contra él.
- La persistencia se activa solo si nadie la apagó y hay una razón (config
  cargada, almacén inyectado, `--sesion`, `--rama-de` o `--continuar`).
- Prioridad de reanudación: `ramaDe` > `sesionId` > `continuar`.

Defaults: `ventanaContexto` 128.000, prompt de sistema propio, proveedor/modelo
tomados de la config, agente `build`.

---

## 3. Ciclo del turno

```
enviarMensaje → ejecutarIteracion → core.ejecutarTurno (≤25 pasos)
     → proveedor.enviar → tools → historial → proveedor.enviar → ...
```

### 3.1 `SesionInteractiva.enviarMensaje` (`interface/runner.ts:578`)

1. Rechaza si ya hay un turno en curso (`ErrorTurnoEnCurso`).
2. Mide el prompt con `presupuesto.validarEnvio`; si excede, agrega aviso y no
   envía nada.
3. Agrega el mensaje del usuario al historial visual y al de mensajes.
4. Ejecuta el núcleo y bombea sus eventos aplicándolos al estado visual.
5. Persiste la diferencia de mensajes, procesa contexto y actualiza métricas.
6. Mientras el turno terminó `completado` y haya tareas background pendientes o
   resultados sin inyectar, espera y ejecuta otra iteración (máximo 8).

### 3.2 `ejecutarTurno` (`core/turn.ts:212`)

- Clona el historial y valida atomicidad antes de empezar.
- `while (paso < maxPasos)` con `maxPasos = 25` por defecto.
- Cada paso emite `paso_inicio`, consulta al proveedor, agrega el mensaje
  `assistant` con texto y/o `llamadasHerramientas`, y decide:

| Situación | Resultado |
|---|---|
| sin llamadas a tools | `completado` |
| con tools | ejecuta tandas y, si `paso < max`, vuelve a iterar |
| al llegar a 25 con tools | evento `limite_pasos_alcanzado` + mensaje de cierre + `completado` |
| señal abortada en cualquier punto | `cancelado` |
| error del proveedor | `fallido` con el mensaje como `motivo` |

### 3.3 Ejecución de herramientas (`core/batches.ts:269`)

1. **Detector de bucles** (`loops.ts`): canoniza argumentos (claves ordenadas) y
   bloquea la tercera repetición consecutiva idéntica con un error de texto. No
   aborta el turno.
2. **Tandas**: llamadas consecutivas con `admiteParalelo: true` van juntas; una
   tool serial corta la tanda y se ejecuta sola.
3. **Permisos por tanda**: `permitir` pasa; `denegar` produce resultado de error;
   `consultar` emite `espera_aprobacion` y espera la decisión.
4. **Ejecución concurrente**: emite `herramienta_inicio` para todas y
   `herramienta_fin` a medida que terminan; los resultados se ordenan al
   escribirlos en el historial.
5. **Despacho** (`dispatch.ts:207`): cancelación → búsqueda en el registro →
   normalización de argumentos → validación contra el esquema → permiso (salvo
   que la tanda ya lo haya resuelto) → ejecución con `AbortSignal`.
6. Los resultados se agregan como mensajes `rol: 'tool'` con `idLlamada`.

### 3.4 Errores, cancelación y bucles

- Toda excepción de una tool se convierte en
  `ERROR: <mensaje>\nLa operación no se completó.`; se sanitiza contra credenciales
  y se trunca a 5.000 caracteres (`dispatch.ts:264`).
- Herramienta inexistente y argumentos inválidos también devuelven texto, no
  excepciones.
- Cancelar aborta el `AbortController` del turno, la espera de aprobación y todas
  las tareas background.
- Al cancelar a mitad de tanda, las llamadas sin resultado se completan en el
  historial con un error de cancelación para no romper la atomicidad.
- `validarHistorialAtomico` exige que cada mensaje `tool` tenga un `assistant`
  previo que haya pedido esa llamada.

---

## 4. Provider

### 4.1 Contrato (`provider/types.ts:17`)

```ts
interface Proveedor {
  readonly nombre: string
  readonly modelo?: string
  enviar(peticion): AsyncGenerator<EventoProveedor, void, unknown>
}
```

Eventos posibles: `texto` (delta), `solicitud_herramienta` (id, nombre,
argumentos) y `fin` (razón `completado`/`interrumpido`, tokens).

### 4.2 Resolución (`provider/factory.ts:46`)

- Adaptadores registrados por `tipo`; hoy solo `openai-compatible` (cubre
  OpenRouter).
- Selección: proveedor/modelo explícito → `proveedorPorDefecto` →
  `modeloPorDefecto` → primero de la lista.
- Un id `proveedor/modelo` se parte por la **primera** barra.
- Credencial: `variableApiKey` del entorno (error si falta) o `apiKey` literal.
- `credencialesSanitizar` reúne todas las credenciales conocidas de longitud ≥ 4.

### 4.3 Adaptador OpenAI-compatible (`provider/adapters/openai-compatible.ts`)

- URL: `baseUrl` sin barras finales + `/chat/completions`.
- Cuerpo: `model`, `messages`, `stream: true`,
  `stream_options.include_usage: true`, `tools` solo si hay y el modelo las
  soporta, `max_tokens` si está configurado.
- Traducción de mensajes: `tool` → `tool` + `tool_call_id`; `assistant` →
  `tool_calls` con argumentos serializados; el prompt de sistema se antepone solo
  si el primero no es `system`.
- Respuesta no OK → `ErrorProveedor` con `codigoEstado` y `esTransitorio`
  (`429` o `5xx`); el mensaje se redacta contra la API key.
- SSE: acumula buffer, procesa líneas completas, ignora comentarios y `data:`
  vacíos, corta en `[DONE]`.
- Los `tool_calls` llegan fragmentados: se acumulan por índice y se emiten
  completos **al final** del stream.
- `finish_reason === 'length'` se reporta como `fin` con razón `interrumpido`.
- Errores dentro del stream se convierten en `ErrorProveedor`.

### 4.4 Reintentos (`provider/retry.ts:45`)

3 intentos, espera 500 ms con factor 2, solo para errores transitorios: 429, 5xx,
`ECONNRESET`, `ETIMEDOUT`. Los no transitorios y el último intento se propagan.

### 4.5 Configuración (`provider/config.ts`)

- Dos archivos: global (`~/.config/harness/config.json`, `%APPDATA%` en Windows) y
  de proyecto (`.harness/config.json`).
- El del proyecto pisa al global; un proveedor del proyecto reemplaza entero al
  homónimo.
- Sin ninguno de los dos, error con la ruta a crear.
- Valida tipos de proveedor, `baseUrl`, credenciales, cabeceras y cada modelo
  (`id` obligatorio; ventana y `maxTokensSalida` positivos; `soportaHerramientas`
  booleano).
- `sesiones.guardar` y `sesiones.maximo` son opcionales.

`provider/mock.ts` implementa el mismo contrato con respuestas guionadas
(fragmentos, tools, tokens, fallos transitorios) y guarda las peticiones recibidas.

---

## 5. Herramientas

Catálogo por plataforma (`tools/catalog.ts:64`).

- Las tools de archivo (`read`, `write`, `edit`, `apply_patch`) resuelven cada
  ruta con `resolverRuta`; `glob`, `grep` y `shell` trabajan directamente sobre el
  directorio del proyecto.
- Ninguna ruta se rechaza: una ruta fuera del proyecto o dentro de `.harness`/`.env*`
  pide aprobación obligatoria (excepto `.env.example`). La decisión vive en el
  portero, no en la tool.
- `glob` y `grep` ignoran `node_modules`, `.git`, `.vitest`, `coverage`, `dist`,
  `.harness` y archivos de entorno.
- Las tools que devuelven contenido (`read`, `grep`, `shell`, `apply_patch`)
  truncan a 30.000 caracteres con un marcador explícito.

| Tool | Permiso | Paralelo | Comportamiento |
|---|---|---|---|
| `read` | `read` | sí | lee archivo completo o tramo `inicio`/`fin` 1-indexado inclusive |
| `write` | `edit` | no | crea directorios padres, sobrescribe, informa caracteres |
| `edit` | `edit` | no | reemplaza una única ocurrencia exacta; tolera LF/CRLF y restaura el EOL dominante |
| `apply_patch` | `edit` | no | parche multiarchivo `*** Begin/End Patch` con bloques Add/Update/Delete; valida todo antes de escribir |
| `glob` | `glob` | sí | patrón → regex, solo archivos, devuelve JSON ordenado; patrones con `..` devuelven `[]` |
| `grep` | `grep` | sí | búsqueda literal; devuelve `ruta:línea: texto`; omite archivos ilegibles |
| `shell` | `shell` / `shell_compuesto` / `shell_redireccion` | no | ejecuta una invocación simple; lo riesgoso pide aprobación obligatoria |
| `task` | `subagent` | no | delega a un subagente (sección 7) |
| `task_status` | `read` | sí | estado de una tarea background o listado completo |
| `task_cancel` | `subagent` | no | cancela una tarea en curso |

### 5.1 `shell` (`tools/shell.ts`)

- `analizarLinea` recorre la línea una sola vez, respetando comillas y escapes, y
  separa segmentos, redirecciones y composición.
- En Unix una línea compuesta (`;`, `&&`, `||`, `|`) se evalúa con
  `shell_compuesto`; un segmento de la lista negra pide aprobación obligatoria para
  la línea completa.
- Un intérprete con bandera de código (`bash -c`, `node -e`, `python3 -c`) cuenta
  como compuesto y pide aprobación obligatoria; `$()` y backticks también.
- `resolverAccion` decide por llamada: `shell_compuesto` si compone, si no
  `shell_redireccion` si redirige a un archivo, si no `shell`.
- Acepta `directorio`, resuelto con `resolverRuta` y verificado como directorio
  existente; fuera del proyecto o dentro de `.harness` pide aprobación obligatoria.
- Extrae el binario (soporta comillas, rutas y `.exe`) y lo compara en minúsculas.
- Unix: lista negra explícita (`rm`, `chmod`, `sudo`, `kill`, `mount`, etc.) **y**
  catálogo conocido (`git`, `npm`, `node`, `cargo`, `python`, `ls`, `grep`, …). Un
  comando fuera del catálogo pide aprobación obligatoria, no se rechaza.
- Windows: catálogo permitido, ejecutado con PowerShell
  (`-NoProfile -NonInteractive -Command`); la composición pide aprobación
  obligatoria.
- `2>&1`, `n>&m`, `n>&-` y la redirección a `/dev/null` siguen siendo una
  invocación simple. Un heredoc, herestring o sustitución de proceso pide
  aprobación obligatoria sin validar el contenido.
- Unix usa `exec` con `maxBuffer` de 10 MB; código de salida distinto de 0 se
  informa con la salida.

### 5.2 Rutas (`tools/path.ts`)

`resolverRuta` resuelve la ruta sin restricciones. `evaluarRiesgoRuta` clasifica
`fueraDelProyecto` y `sensible`, siguiendo el `realpath` para que un symlink no
escape; una ruta nueva resuelve el ancestro existente más cercano.
`motivoAprobacionRuta` convierte ese riesgo en el motivo que la tool declara al
portero.

---

## 6. Contexto

Presupuesto (`context/budget.ts`): `limite = ventana * 0.8`; el 20% restante es
margen intocable. Umbrales: “cerca” al 85% del límite (68% de la ventana), “al
límite” al 100% del límite.

Conteo (`context/tokens.ts`): usa `entrada + salida` del provider si existe; si no,
estima `caracteres / 4` redondeando hacia arriba.

### 6.1 Dentro del turno

Antes de cada envío, `prepararHistorialPaso` (`runner.ts:534`):

- si no está cerca del límite, no toca nada;
- si está cerca, recorta resultados viejos de tools;
- si aun así supera el límite, devuelve error y el paso falla **antes** de enviar.

### 6.2 Al final del turno (`context/pipeline.ts:23`)

1. Mide. Si no está cerca, termina.
2. Recorta (`trimming.ts`): reemplaza el `resultado` de todas las tools antiguas
   por `[Contenido de herramienta omitido...]`, conservando `idLlamada`. No toca
   mensajes de usuario, assistant ni el último resultado de tool.
3. Si con el recorte alcanza, termina con `recortado: true`.
4. Si no, compacta en bucle (máximo 8 iteraciones) conservando 2 y luego 1 turno
   reciente. Corta cuando baja del límite, cuando no hay progreso o al agotar las
   iteraciones.

### 6.3 Compactación (`context/compaction.ts:78`)

- Separa el prompt de sistema (si el primer mensaje es `system` y no es un resumen
  automático) y descarta los resúmenes previos.
- Un “turno” empieza en cada mensaje `rol: 'user'`; solo se corta en esa frontera.
- Resume los turnos antiguos en **un único** mensaje `system` con el encabezado
  `[RESUMEN GENERADO AUTOMÁTICAMENTE - NO SON HECHOS VERIFICADOS]`.
- El resumen es determinista y local, sin llamada al modelo: extrae `archivo:línea`,
  mensajes de error y menciones de “corregido”; arrastra los hechos de resúmenes
  anteriores.
- Nuevo historial: `[prompt sistema?] + [resumen] + [turnos recientes]`.
- Valida atomicidad antes de devolverlo; si falla, el pipeline devuelve el
  historial original y reporta el error como aviso.
- Si después de compactar sigue por encima del límite, avisa que no se enviarán
  más peticiones hasta reducir el historial.

### 6.4 Efectos

Se registra `ultimaCompactacion` (tokens y mensajes antes/después), se muestra
`Historial compactado automáticamente.` y se persiste el historial compactado
(sección 8). Cambiar de modelo resetea el conteo del provider y recalcula el
presupuesto con la nueva ventana.

---

## 7. Agentes y subagentes

### 7.1 Definiciones (`agents/definiciones.ts`)

Campos: `nombre`, `descripcion`, `modo` (`primario` | `subagente` | `ambos`),
`herramientas`, `prompt?`, `modelo?`, `permisos?`.

Validación estricta: nombre único, modo válido, lista de herramientas existente en
el catálogo, subagentes limitados a `read`/`glob`/`grep`, modelo presente en la
configuración, permisos con acción/recurso/efecto válidos.

### 7.2 Carga (`agents/cargar.ts:115`)

- Sin `.harness/agents.json`, usa los defaults.
- Con archivo, valida cada agente y lo fusiona por nombre con los defaults.
- `incluirDefaults` puede desactivarse; por defecto se incluyen si no hay agentes
  o si alguno es primario.
- Agente por defecto: `agentePorDefecto` del archivo si es primario; si no, el
  primer primario; si no hay, `build`.

Defaults (`agents/defaults.ts`): `build` (primario, todas las tools), `plan`
(primario, solo lectura) y `explore` (subagente, solo lectura).

En ejecución, cada turno filtra el catálogo a las tools del agente activo y usa su
modelo si declara uno. El prompt efectivo concatena prompt base y prompt del
agente.

### 7.3 Delegación (`subagents/ejecutor.ts:102`)

- Profundidad máxima 1: un subagente no puede lanzar otro (`enTurnoHijo`).
- Solo agentes `subagente` o `ambos` son lanzables.
- Contexto aislado: arranca con un único mensaje `user` con el pedido; no hereda
  el historial del padre.
- Herramientas: intersección con solo lectura y exclusión de `task`.
- Presupuesto propio sobre la ventana del modelo del subagente (heredada o
  resuelta); si el pedido solo ya lo excede, devuelve error.
- Pasos y modelo propios; prompt base + prompt del agente.
- Cancelación unidireccional: abortar el padre aborta al hijo; abortar al hijo no
  afecta al padre.
- Resultado: último texto del `assistant` o lo acumulado en streaming, truncado.
  Límite de pasos, cancelación y fallo vuelven como texto `ERROR:`.

### 7.4 Background (`subagents/background.ts`)

- Máximo 4 tareas en curso; al superarlo, `task` devuelve error.
- Estados: `en_curso`, `completada`, `cancelada`, `fallida`. Una excepción nunca
  escapa: se guarda como resultado fallido.
- `task_cancel` solo cancela tareas en curso.
- `consumirResultados` arma un bloque `[Resultados de tareas en background]` con
  las tareas terminadas no inyectadas y las marca; una tarea nunca se inyecta dos
  veces.
- El turno padre espera las pendientes y continúa el turno con ese bloque como
  mensaje `user`, hasta 8 continuaciones.
- La barra de estado muestra la cantidad de tareas en curso (`N bg`).

---

## 8. Sesiones

Almacenamiento: `.harness/sesiones/<id>/` con `sesion.json` (metadatos) y
`eventos.jsonl` (registros de solo agregado). Directorios `0700`, archivos `0600`.

- Id por defecto: `AAAAMMDD-HHMMSS-xxxx` (fecha, hora y 2 bytes aleatorios).
- Ids válidos: `[A-Za-z0-9._-]+`, sin `.` ni `..`.
- Metadatos: id, fechas, directorio, modelo, agente, cantidad de mensajes y, en
  ramas, `padre` y `desdeTurno`.
- Registros: `{tipo:'turno', estado, mensajes}` y `{tipo:'compactacion', mensajes}`.
- Reproducción (`sesiones/formato.ts:155`): los turnos **agregan**; la
  compactación **reemplaza** todo el historial acumulado.
- Antes de persistir, cada cadena se sanitiza con las credenciales conocidas.
- Un registro inválido en medio del archivo es error; en la última línea se
  ignora (permite un corte de escritura).
- Poda: se conservan como máximo 50 sesiones; se eliminan las más viejas salvo la
  activa.
- Ramificar copia el historial hasta el turno indicado y lo guarda como
  compactación inicial de la sesión nueva.
- Listado ordenado por `actualizadaEn` descendente.
- Búsqueda por texto en el historial reproducido de todas las sesiones; devuelve
  coincidencias, fragmento y metadatos.
- Cambiar modelo/agente actualiza los metadatos; si falla, solo se muestra un
  aviso.

`SesionInteractiva` crea la sesión al construirse si hay almacén, restaura
historial/modelo/agente al reanudar y descarta el modelo guardado si ya no existe
(conserva el historial).

---

## 9. Permisos

Reglas ordenadas `{accion, recurso, efecto}` con efecto `permitir`, `consultar` o
`denegar`. **La última regla que coincide gana**; si ninguna coincide, el efecto
es `consultar`.

- Acciones canónicas: `read`, `glob`, `grep`, `edit`, `shell`, `shell_compuesto`,
  `shell_redireccion`, `subagent`, `external_directory`; se aceptan alias en
  español e inglés (`leer`, `editar`, `ejecutar`, `comando_compuesto`,
  `redireccion`, etc.). Acción desconocida → `read`.
- Patrones: `*` cubre cualquier secuencia (incluida `/`), `?` un carácter; un
  patrón terminado en ` *` también acepta el valor sin argumentos.
- Composición de reglas, en este orden: base, archivo de proyecto
  (`.harness/config.json` y `.harness/permissions.json`), reglas inyectadas y
  reglas del agente (las últimas en evaluarse).
- Base: todo permitido; `.env` y `.env.*` en lectura pasan a `consultar`;
  `.env.example` permitido; todo `shell_compuesto` y `shell_redireccion` pasa a
  `consultar`.
- **Aprobación obligatoria**: una tool declara un motivo con
  `motivoAprobacionObligatoria(args)`. Si lo declara, el efecto es `consultar` con
  `obligatoria: true` aunque una regla `permitir` o una aprobación guardada
  coincidan. Una regla `denegar` configurada gana y deniega sin preguntar.
- Rutas fuera del proyecto se evalúan como `external_directory`; un `denegar`
  corta, un `consultar` exige aprobación.
- Aprobaciones guardadas (`.harness/approvals.json`) convierten `consultar` en
  `permitir`, salvo que la aprobación sea obligatoria.
- Operación con varios recursos: cualquier `denegar` deniega todo; si no, el
  primer `consultar` decide el recurso reportado.
- `solicitarAprobacion` sin TTY o sin manejador → `denegar`. Con manejador:
  `siempre` persiste una regla con el patrón sugerido; en una aprobación
  obligatoria `siempre` se normaliza a `una_vez` y no persiste nada; `denegar`
  rechaza además todas las aprobaciones pendientes.
- Patrón sugerido: para `shell`, `shell_compuesto` y `shell_redireccion`, los dos
  primeros tokens + ` *`; para rutas, la ruta normalizada.
- El portero se evalúa en dos puntos: la tanda completa antes de ejecutar y el
  despacho individual (que puede omitir el gate si la tanda ya lo hizo).

---

## 10. Interfaz

### 10.1 Estado visual (`interface/state.ts`)

Eventos → estado inmutable: texto en streaming, tarjetas de herramientas en curso
(una o varias en paralelo), delegaciones diferenciadas (`task`), avisos,
aprobación pendiente, límite de pasos y tareas background. Al cerrar el turno, el
texto en streaming se fija en el historial y se agrega `Turno cancelado.` si
correspondió. Nunca decide nada: solo refleja.

### 10.2 TUI (`interface/app-interactiva.tsx`)

- Monta Ink con `exitOnCtrlC: false`; la cancelación la decide la sesión.
- Barra de estado: modelo, agente, id de sesión, `N bg`, estado
  (`listo`/`trabajando`/`esperando aprobación`) y uso de contexto con marca `est.`
  si es estimado.
- Entrada: Enter envía, Shift+Enter o Ctrl+J insertan salto, Tab cambia de agente,
  ↑/↓ recorren el historial de pedidos, `/` abre la paleta, Esc cierra paneles,
  Ctrl+C cancela, Ctrl+D sale, pegar entra como una sola operación.
- Aprobaciones: `1`/`y`/`s` una vez, `2`/`a` siempre, `3`/`n`/Esc denegar.
- Comandos: `/agente`, `/modelo`, `/contexto`, `/sesiones [id|buscar <texto>]`,
  `/nueva`, `/rama <n>`, `/ayuda`, `/salir` (con alias en inglés).
- Cambiar modelo, agente, sesión o rama se rechaza durante un turno en curso.
- Al adoptar otra sesión o rama se cancelan las tareas background, se restaura el
  historial y se resetean métricas y conteos.

### 10.3 Modo plano (`interface/plain.ts`)

Sin TTY, cada snapshot del estado se traduce a líneas `[Sistema]`, `[Usuario]`,
`[Asistente]`, `[Herramienta: x]`, `[Subagente: x]`, `[Aviso]`, con marcas
`[ERROR]` y `[TRUNCADO]`. Solo agrega; no redibuja.

---

## 11. Reglas transversales

1. **Un error no se tira: vuelve como texto.** Tools, subagentes, sesiones y
   aprobaciones fallan con `ERROR: ...\nLa operación no se completó.` para que el
   modelo pueda corregirse.
2. **Credenciales redactadas.** Se sanitiza todo mensaje de error, resultado
   persistido y aviso; los encabezados sensibles se reemplazan por `[REDACTADO]`.
3. **Truncado explícito.** 30.000 caracteres en salidas de tools, 5.000 en errores
   de despacho, con marcadores visibles.
4. **Sin base de datos.** Estado en memoria; persistencia solo JSON/JSONL.
5. **Escritor único.** Un proceso por proyecto escribe las sesiones; no hay
   bloqueo entre procesos.
6. **Dirección de dependencias.** `core/` no importa `interface/` ni `provider/`
   como valores: recibe proveedor y registro por parámetro y devuelve eventos.
7. **Sin `any`.** Los datos que vienen del modelo se tratan como `unknown` y se
   validan en la frontera antes de usarse.
