# Spec Delta

## Purpose

Los hooks son acciones deterministas que el modelo no puede saltear: el harness las
ejecuta en eventos del ciclo de vida y su código de salida decide si el turno sigue,
avisa o se bloquea. Esta capacidad las declara, las ejecuta y aísla sus fallos.

## ADDED Requirements

### Requirement: El sistema declara hooks en la configuración
El sistema SHALL leer los hooks de la clave `hooks` del config, con una lista por
evento. Cada entrada SHALL declarar un `comando` y MAY declarar un `match` con una
expresión regular sobre el nombre de la herramienta. Una entrada sin `comando`, con
un evento desconocido o con un `match` inválido SHALL fallar el arranque con un
mensaje que nombre el evento y la posición. Sin hooks configurados, el sistema
SHALL comportarse como hoy.

#### Scenario: Una configuración válida
- **WHEN** el config declara hooks con `comando` y `match` válidos
- **THEN** el sistema los registra por evento

#### Scenario: Una entrada sin comando
- **WHEN** una entrada de la lista no declara `comando`
- **THEN** el arranque falla nombrando el evento y la posición

#### Scenario: Un evento desconocido
- **WHEN** el config declara un evento que no es uno de los cinco
- **THEN** el arranque falla nombrando el evento

#### Scenario: Sin hooks configurados
- **WHEN** el config no declara la clave `hooks`
- **THEN** la sesión se comporta igual que sin esta capacidad

### Requirement: El sistema ejecuta el hook con el contexto del evento
El sistema SHALL ejecutar cada hook con un objeto JSON por entrada estándar que
incluya `evento` y `proyecto` y, cuando corresponda, `herramienta`, `argumentos` y
`resultado`. El sistema SHALL esperar a que el hook termine antes de continuar. El
sistema SHALL aplicar un timeout configurable de 30 segundos por defecto; al vencer
SHALL tratar el hook como fallo con aviso y continuar.

#### Scenario: preTool recibe la herramienta y sus argumentos
- **WHEN** el sistema va a ejecutar una herramienta y hay un hook `preTool`
- **THEN** el JSON de entrada incluye `herramienta`, `argumentos` y `proyecto`

#### Scenario: postTool recibe el resultado
- **WHEN** una herramienta terminó y hay un hook `postTool`
- **THEN** el JSON de entrada incluye el `resultado`

#### Scenario: sessionStart no recibe herramienta
- **WHEN** arranca la sesión y hay un hook `sessionStart`
- **THEN** el JSON de entrada no incluye `herramienta` ni `argumentos`

#### Scenario: Un hook que se cuelga
- **WHEN** un hook no termina dentro del timeout
- **THEN** el sistema lo corta, avisa y el turno continúa

### Requirement: El código de salida del hook decide
El sistema SHALL interpretar el código de salida: `0` continúa sin cambios, `1`
continúa y agrega la salida estándar como nota visible, `2` bloquea. En `preTool` un
`2` SHALL impedir la ejecución de la herramienta y devolver el mensaje como error de
texto. En `postTool` un `2` SHALL reemplazar el resultado por un error de texto. En
`sessionStart` un `2` SHALL impedir el arranque. En `turnEnd` y `sessionEnd` un `2`
SHALL tratarse como aviso. Cualquier otro código SHALL tratarse como `1`.

#### Scenario: Un hook que aprueba
- **WHEN** el hook termina con código `0`
- **THEN** el turno continúa sin cambios

#### Scenario: Un hook que advierte
- **WHEN** el hook termina con código `1` y escribe en la salida estándar
- **THEN** el modelo recibe esa salida como nota y el turno continúa

#### Scenario: Un hook que bloquea antes de la herramienta
- **WHEN** un hook `preTool` termina con código `2`
- **THEN** la herramienta no se ejecuta y el modelo recibe el mensaje como error de texto

#### Scenario: Un hook que bloquea después de la herramienta
- **WHEN** un hook `postTool` termina con código `2`
- **THEN** el resultado de la herramienta se reemplaza por el mensaje como error de texto

#### Scenario: Un hook que impide arrancar
- **WHEN** un hook `sessionStart` termina con código `2`
- **THEN** la sesión no arranca y el mensaje del hook es visible

#### Scenario: Un bloqueo al cerrar no cancela el cierre
- **WHEN** un hook `turnEnd` o `sessionEnd` termina con código `2`
- **THEN** el sistema lo trata como aviso

#### Scenario: Un código inesperado
- **WHEN** el hook termina con un código distinto de `0`, `1` y `2`
- **THEN** el sistema lo trata como aviso y el turno continúa

### Requirement: Un hook que falla no detiene la sesión
Si el comando no existe o no se puede ejecutar, el sistema SHALL devolver un aviso
como texto y SHALL continuar. El sistema SHALL NOT propagar la excepción. La salida
SHALL limitarse a 8 KiB con un marcador de truncado. La salida SHALL pasar por la
sanitización de credenciales.

#### Scenario: Un comando inexistente
- **WHEN** el hook apunta a un comando que no existe
- **THEN** el sistema devuelve un aviso como texto y el turno continúa

#### Scenario: Una salida gigante
- **WHEN** el hook imprime más de 8 KiB
- **THEN** el sistema trunca la salida y deja un marcador

#### Scenario: La salida no filtra la credencial
- **WHEN** la salida del hook contiene la credencial configurada
- **THEN** el texto entregado la tiene redactada

### Requirement: Los hooks respetan los permisos
El sistema SHALL evaluar cada hook con la acción `hook` y el nombre del evento como
recurso. Sin reglas aplicables, el sistema SHALL pedir aprobación antes de
ejecutarlo. Una regla `permitir` SHALL ejecutarlo sin preguntar. Una regla `denegar`
SHALL omitirlo con un aviso. El sistema SHALL ejecutar los hooks de herramienta
después del portero: una herramienta denegada SHALL NOT disparar `preTool`.

#### Scenario: Sin reglas se pide aprobación
- **WHEN** no hay una regla que alcance el evento
- **THEN** el sistema pide aprobación antes de ejecutar el hook

#### Scenario: Una regla permitir lo ejecuta sin preguntar
- **WHEN** una regla `permitir` alcanza la acción `hook` con ese evento
- **THEN** el hook se ejecuta sin pedir aprobación

#### Scenario: Una regla denegar lo omite
- **WHEN** una regla `denegar` alcanza la acción `hook` con ese evento
- **THEN** el hook no se ejecuta y el sistema avisa

#### Scenario: Una herramienta denegada no dispara preTool
- **WHEN** el portero bloquea una herramienta
- **THEN** el hook `preTool` de esa herramienta no se ejecuta

### Requirement: Los cinco eventos tienen su punto de disparo
El sistema SHALL disparar `sessionStart` una vez al construir la sesión, `preTool`
antes de cada herramienta y después del portero, `postTool` después de cada
herramienta con su resultado, `turnEnd` al terminar el turno —incluida la
cancelación— y `sessionEnd` al cerrar. En subagentes SHALL disparar `preTool` y
`postTool`; SHALL NOT disparar `sessionStart` ni `sessionEnd`.

#### Scenario: Cada evento se dispara una vez
- **WHEN** un turno ejecuta una herramienta
- **THEN** se disparan `preTool`, `postTool` y `turnEnd` una vez cada uno

#### Scenario: Un subagente dispara solo los de herramienta
- **WHEN** un subagente ejecuta una herramienta
- **THEN** dispara `preTool` y `postTool` y no dispara `sessionStart` ni `sessionEnd`

#### Scenario: Un turno cancelado cierra igual
- **WHEN** la persona cancela el turno
- **THEN** `turnEnd` se dispara
