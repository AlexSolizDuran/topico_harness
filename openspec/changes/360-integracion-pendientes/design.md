# Design

## Context

Ver `proposal.md - Why`. El estado actual que condiciona el diseño:

- `src/app.ts` concentra el ensamblado (`construirHarness`) y recibe las
  dependencias por parámetro. El núcleo no conoce la interfaz ni los módulos
  concretos.
- El catálogo de herramientas es el `RegistroHerramientas` de `src/core/`;
  `SesionInteractiva` filtra por `agente.herramientas` antes de enviar el turno.
- El prompt de sistema se compone de prompt base + instrucciones + skills +
  prompt del agente, y el presupuesto suma `tokensSistemaInstrucciones` y
  `tokensSkills`.
- Los módulos `src/memory/`, `src/sandbox/`, `src/lsp/` y `src/mcp/` existen con
  API pública y tests, pero no se importan desde `src/app.ts` ni desde
  `src/provider/config.ts`.
- Los changes archivados de implementación declararon la integración como hecha,
  pero las tareas `2.1`/`2.2` no dejaron rastro en el código.

## Goals / Non-Goals

**Goals:**

- Dejar las 16 capacidades operativas desde el arranque, con las claves de
  configuración y la visibilidad por agente que exigen los specs.
- Corregir los huecos de los módulos que impiden cumplir sus escenarios en un
  entorno real.
- Mantener la dirección de dependencias: `core/` no importa `interface/` ni los
  módulos concretos; `app.ts` los inyecta.
- No cambiar ningún requisito ni escenario de `openspec/specs/`.

**Non-Goals:**

- Transporte MCP remoto, OAuth, recursos o prompts MCP.
- Recarga en caliente de servidores o configuración.
- Herramientas nuevas no especificadas (por ejemplo, una herramienta `memory`
  separada; el detalle se lee con `read`).
- Cambiar el catálogo, la lista negra o el modelo de permisos.

## Decisions

### Configuración en `src/provider/config.ts`

Se agregan cuatro interfaces a `ConfiguracionHarness`:

```ts
sandbox?: ConfiguracionSandbox
memoria?: { usuario?: boolean; modelo?: string; rutaUsuario?: string }
lsp?: ConfiguracionServidorLsp[]
mcp?: ConfiguracionServidorMcp[]
```

Cada validador reutiliza o replica el patrón de `validarHooks`: objeto, campos
obligatorios, tipos y mensajes que nombran la entrada. Un valor inválido falla el
arranque; una clave ausente deja el comportamiento actual.

Merge global + proyecto: `mcp` y `lsp` se combinan por identidad (`id` y
`lenguaje` respectivamente); el proyecto reemplaza la entrada global con la misma
identidad y agrega las nuevas. `sandbox` y `memoria` se pisan por campo, como
`sesiones`.

### Visibilidad por agente

`DefinicionAgente` gana `mcp?: string[]`. La validación recibe el conjunto de
servidores configurados y rechaza un identificador inexistente. En
`SesionInteractiva`, la lista de herramientas del turno pasa a ser:

```
herramientas base del agente ∪ herramientas de los servidores MCP declarados
```

La unión se resuelve con un callback inyectado (`obtenerHerramientasExtra`) para
que el runner no importe `src/mcp/`. Los subagentes aplican la misma regla después
de su intersección de solo lectura; un servidor declarado por un subagente solo
aporta herramientas si su definición lo permite, y el spec de `subagents` sigue
mandando.

### Sandbox

`OpcionesShell.ejecutor` se extiende de forma compatible:

```ts
ejecutor?: (comando: string, cwd: string) => Promise<{
  salida: string
  codigoSalida: number
  aislamiento?: InformacionAislamiento
  avisoAislamiento?: string
}>
```

La herramienta `shell` agrega al resultado una línea con el estado del
aislamiento. Si no corrió aislada, incluye el motivo y no afirma lo contrario. El
aviso visible se entrega por callback (`alAvisoAislamiento`) que `app.ts` conecta
a `SesionInteractiva.agregarAviso`.

`determinarMecanismoAislamiento` deja de asumir disponibilidad: en Linux comprueba
`bwrap` y en macOS `sandbox-exec`; si no existen, devuelve `aislado: false` con
motivo. Si el proceso del sandbox falla al arrancar, el resultado también se
degrada a no aislado; nunca se reporta como aislado algo que no se ejecutó dentro
del mecanismo.

### LSP

`GestorLsp` se instancia siempre y `crearHerramientaLsp` se registra en el
catálogo. Sin servidores configurados, la herramienta devuelve el error como
texto, que es el comportamiento que exige el spec.

Los diagnósticos post-edición no se agregan en `core/`: se decora en el catálogo
la entrada de `edit`, `write` y `apply_patch`. El decorador:

1. Ejecuta la herramienta original.
2. Si el resultado es un error, lo devuelve sin tocar.
3. Si fue una edición exitosa, obtiene la ruta afectada de los argumentos y pide
   `obtenerDiagnosticosDeArchivo`.
4. Agrega el texto truncado al resultado. Un fallo del LSP se informa como texto
   y no revierte la edición.

Correcciones del cliente para que esto funcione contra un servidor real:
`textDocument/didOpen` antes de la primera consulta, procesamiento de
notificaciones `textDocument/publishDiagnostics` (hoy se descartan porque solo se
miran respuestas con `id`) y `shutdown`/`exit` en `desconectar()`.

### MCP

Configuración:

```json
{ "id": "filesystem", "comando": "npx", "args": ["-y", "..."], "env": ["GITHUB_TOKEN"] }
```

`env` pasa a ser `string[]` de nombres de variables, resueltas desde `process.env`
al arrancar el servidor. Un nombre ausente se omite; el spec prohíbe secretos
literales en el config del proyecto y esta forma los elimina por construcción.

Herramientas: cada `HerramientaMcp` se convierte en una `EntradaHerramienta` con
nombre `<servidor>_<herramienta>`, `accionPermiso: 'mcp'`, recurso
`<servidor>/<herramienta>` y `motivoAprobacionObligatoria` cuando la herramienta
declara riesgo. La validación de argumentos usa un subconjunto real de JSON Schema
(`type`, `properties`, `required`, `enum`, `items`, `additionalProperties`), no el
`passthrough` actual.

Descubrimiento: el spec pide conexión en el primer uso, pero el modelo no puede
invocar una herramienta que no se le anunció. Se adopta esta resolución: al inicio
del primer turno se conectan **solo los servidores que el agente activo declara**
(no todos los configurados), se registran sus herramientas al final del orden y se
anuncian. `GestorMcp.ejecutarHerramienta` sigue asegurando la conexión, así que un
servidor caído se reconecta en un turno posterior. Alternativa descartada: una
herramienta meta `mcp` con `listar`/`ejecutar`, porque pierde el nombre con prefijo
que exige el spec.

### Memoria

Al construir: `AlmacenMemoria` carga el índice y, si la configuración lo declara,
la memoria de usuario. `formatearBloqueMemoria` arma el bloque con marcador, origen
y fecha, y se concatena al prompt base después de las instrucciones del proyecto.
El detalle queda fuera de la carga inicial y se referencia con su ruta; el modelo
lo lee con `read`, que ya evalúa la acción `edit`/`read` correspondiente.

Presupuesto: se agrega `tokensSistemaMemoria` a `OpcionesSesion` y se suma en
`calcularMetricas` y `medirParaEnviar`, junto a instrucciones y skills. La memoria
entra al mismo pipeline de contexto; no se trunca en silencio.

Cierre: `HarnessConstruido.cerrar()` orquesta, en orden:

1. Hooks `sessionEnd` (comportamiento actual).
2. Extracción de memoria sobre el transcript.
3. Cierre de LSP, MCP y sandbox.

Para eso `SesionInteractiva` expone su historial en solo lectura y un método para
agregar avisos. La extracción usa `extraerHechosDeSesion`; si falla, el error se
informa como aviso y el cierre continúa. Antes de guardar se aplica
`resolverContradicciones`; la escritura es la atómica de `AlmacenMemoria`.

## Risks / Trade-offs

- [Conectar servidores MCP al inicio del primer turno agrega esquemas al contexto]
  → Solo se conectan los declarados por el agente activo; los no declarados no se
  tocan y la conexión sigue siendo reintentable.
- [El aislamiento puede no existir o fallar en tiempo de ejecución] → Detección
  de binario y degradación con motivo; nunca se reporta como aislado.
- [El cliente LSP actual puede tener más huecos que `didOpen` y
  `publishDiagnostics`] → Probar contra `typescript-language-server` real durante
  la implementación y dejar el fallo como texto.
- [La extracción de memoria usa un modelo y puede ser costosa] → El modelo se
  declara en `memoria.modelo`; si no se declara, se usa el activo y el fallo no
  bloquea el cierre.
- [Tocar el filtro de herramientas del runner puede afectar subagentes] → La unión
  se implementa como callback y se cubre con tests de agentes primarios y
  subagentes.
- [Los tests actuales de los módulos son de fachada en algunos casos] → Se
  reemplazan o complementan con pruebas contra servidores/procesos reales cuando
  el escenario lo permite.

## Migration Plan

No hay migración de datos. Sin las claves nuevas, el arranque y el comportamiento
son idénticos a los actuales. Los proyectos existentes pueden adoptar las claves
de a una; `agents.json` sigue funcionando sin `mcp` y en ese caso no recibe
herramientas externas.
