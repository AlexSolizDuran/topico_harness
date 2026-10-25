# Design

## Context

El turno despacha herramientas por nombre contra un registro. No hay un punto entre
la solicitud del modelo y la ejecución donde decidir. La lista de herramientas del
agente (`150`) restringe qué ve el modelo, pero no distingue entre ejecutar y
consultar, ni permite una excepción por archivo o comando.

OpenCode V2 resolvió esto con reglas ordenadas y un gate que espera la decisión del
cliente. Este change copia ese comportamiento, no la forma de la configuración.

## Goals / Non-Goals

**Goals:**

- Un único lugar donde se decide si una operación se ejecuta.
- Reglas editables sin recompilar.
- Que denegar no interrumpa el turno y que preguntar no lo corte.
- Que una aprobación "siempre" no sea un cheque en blanco.
- Que el comportamiento sea el de OpenCode V2: última regla gana, sin coincidencia
  se consulta, acciones por efecto, `.env` consulta.

**Non-Goals:**

- Tandas paralelas y orden de ejecución (`180`).
- Sandbox, hooks o políticas de organización.
- Detección de bucles como permiso: no es una acción de OpenCode V2 y queda fuera.
- Persistencia de sesiones.

## Decisions

### Reglas ordenadas, no un mapa

El archivo declara una lista de reglas `{ acción, recurso, efecto }`. Se aplica la
última que coincide y, si ninguna coincide, se consulta. Es lo que permite poner
primero una regla amplia y después las excepciones, sin que el orden del objeto
importe.

Alternativa descartada: un mapa por acción. No expresa excepciones por recurso sin
anidar objetos y hace ambiguo el orden.

### Acciones por lo que hace la herramienta

Las acciones son leer, buscar archivos, buscar texto, editar, ejecutar, delegar y
directorio externo. Editar cubre escribir y editar; ejecutar cubre el shell;
delegar cubre el subagente. El permiso responde qué puede pasar, no qué mecanismo
se usa.

El nombre de la herramienta no participa de la evaluación. La herramienta declara
su acción y cómo extraer el recurso de sus argumentos.

### Política base que permite y protege

La base permite todo, consulta al leer `.env` y `*.env.*`, y permite `.env.example`.
Es la política de OpenCode V2. La ruta externa se permite por defecto y se evalúa
contra directorio externo antes que contra leer o editar; consultar afuera es una
regla opt-in.

El `.env` se consulta, no se deniega: la persona puede decidir leerlo, y la
plantilla se permite sin preguntar. Denegarlo por defecto haría imposible el caso
legítimo.

### El agente agrega, no reemplaza

Las reglas del agente se concatenan al final de las globales. Un agente puede
volver a consultar algo que el global permite, o denegar algo que el global permite.
No puede permitir lo que una regla global posterior deniegue, porque el orden manda.

Un subagente usa sus propias reglas, no un subconjunto de las del padre. La
restricción de herramientas del subagente (`160`) sigue siendo la primera barrera;
el permiso es la segunda.

### El gate espera, no corta

El despacho consulta el permiso y, si el efecto es consultar, espera una promesa
que resuelve la interfaz. El turno sigue en curso; la barra muestra que espera una
decisión.

Alternativa descartada: cortar el turno y relanzarlo con la decisión. Parte el
historial, obliga a un cuarto estado del turno y hace más difícil razonar sobre los
efectos ya ejecutados. OpenCode espera; nosotros también.

El núcleo no importa `permissions/`: recibe el evaluador y el solicitante de
aprobación por parámetro. Si no se inyectan, no hay gate y todo se ejecuta, que es
el comportamiento de los llamadores existentes.

### Una operación, varios recursos

Si una operación toca varios recursos, cualquier denegación deniega el conjunto; si
no, cualquier consulta consulta; si no, se permite. Es la regla de OpenCode y evita
que un parche que toca tres archivos se ejecute a medias.

### Aprobaciones: una vez, siempre y denegar

- Una vez: ejecuta esa solicitud y la siguiente vuelve a consultar.
- Siempre: guarda una regla de permitir con el patrón que propone la herramienta
  —prefijo de comando para ejecutar, ruta para editar— y deja de consultar ese
  patrón.
- Denegar: rechaza la solicitud y las demás pendientes de la sesión; el modelo
  recibe el rechazo como texto.

Las aprobaciones guardadas son durables y con alcance de proyecto, en un archivo
ignorado por git. Nunca pisan una denegación configurada: si la regla que gana es
`deny`, la aprobación no la resucita.

Alternativa descartada: aprobación solo en memoria. Se pierde al reiniciar y la
persona vuelve a responder lo mismo en cada arranque.

### Sin terminal se deniega

Un cliente no interactivo no puede preguntar. La resolución segura es denegar y
explicar la acción y el recurso. Para automatizar, se agregan reglas de permitir al
archivo; no hay un modo que apruebe todo por conveniencia.

### `bash` pasa a `shell`

OpenCode V2 llama `shell` a la herramienta y a la acción. El harness ya documenta
`shell` en `AGENTS.md`, pero el código expone `bash` en Unix y `powershell` en
Windows. Se unifica en `shell`: el modelo ve un solo nombre y el intérprete lo sigue
eligiendo la plataforma. El mecanismo no cambia.

## Risks / Trade-offs

- [Aprobar siempre con un patrón demasiado amplio] → el patrón lo propone la
  herramienta y se guarda como regla visible; una denegación configurada siempre
  gana.
- [El `.env` se consulta y la persona lo aprueba sin mirar] → es su decisión; la
  regla guardada queda acotada al patrón.
- [Reglas guardadas que envejecen] → viven en un archivo ignorado y se pueden borrar
  sin tocar la configuración versionada.
- [Un agente deniega y otro permite el mismo recurso] → el merge por agente es
  explícito; el orden de las reglas es la respuesta.
- [El gate agrega una espera en medio del turno] → la interfaz muestra el estado y
  la cancelación sigue funcionando.

## Migration Plan

Sin migración de datos: no hay permisos previos. Los llamadores que no inyectan el
gate conservan el comportamiento actual. Al archivar, `permissions` se copia desde
`openspec/specs/permissions/spec.md`; los deltas de `core`, `interface` y `tools`
reemplazan o agregan sus requisitos. El orden de archivo es `150`, `160`, `170`.
