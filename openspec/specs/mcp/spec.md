# mcp Specification

## Purpose
MCP conecta servidores externos que aportan herramientas al harness. Esta
capacidad los declara, los conecta bajo demanda, expone sus herramientas y aísla
sus fallos sin que el código del harness conozca cada integración.

## Requirements

### Requirement: El sistema declara servidores MCP en la configuración
El sistema SHALL leer de la configuración los servidores MCP, con un
identificador, el comando de arranque y sus argumentos. SHALL aceptar variables de
entorno por nombre y SHALL NOT aceptar un secreto literal en la configuración del
proyecto. Una entrada incompleta SHALL fallar el arranque con un mensaje que
nombre el servidor. Sin servidores configurados, la sesión SHALL arrancar igual.

#### Scenario: Configuración válida
- **WHEN** la configuración declara un servidor con identificador y comando
- **THEN** el sistema lo registra sin conectarlo todavía

#### Scenario: Servidor sin comando
- **WHEN** una entrada de servidor no declara comando
- **THEN** el arranque falla nombrando el servidor

#### Scenario: Secreto literal rechazado
- **WHEN** la configuración del proyecto incluye un secreto literal en un servidor
- **THEN** el arranque falla sin imprimir el secreto

#### Scenario: Sin servidores
- **WHEN** la configuración no declara servidores MCP
- **THEN** la sesión arranca igual y no hay herramientas externas

### Requirement: Un servidor se conecta bajo demanda y anuncia sus herramientas
El sistema SHALL conectar un servidor MCP la primera vez que el modelo lo usa.
SHALL anunciar solo las herramientas del servidor conectado, con un nombre que
incluya el servidor. SHALL NOT enviar al modelo las herramientas de servidores no
conectados. La conexión de un servidor SHALL agregar sus herramientas al final del
orden estable y SHALL NOT reordenar las anteriores.

#### Scenario: Conexión bajo demanda
- **WHEN** el modelo usa por primera vez una herramienta de un servidor
- **THEN** el sistema conecta el servidor en ese momento

#### Scenario: Solo herramientas del servidor conectado
- **WHEN** un servidor está conectado
- **THEN** el modelo recibe solo las herramientas de ese servidor

#### Scenario: Nombre con prefijo del servidor
- **WHEN** el servidor anuncia una herramienta
- **THEN** el nombre visible incluye el identificador del servidor

#### Scenario: Orden estable
- **WHEN** se conecta un servidor nuevo
- **THEN** sus herramientas se agregan al final y no se reordenan las existentes

#### Scenario: Sin servidores no hay herramientas externas
- **WHEN** no hay servidores conectados
- **THEN** el modelo no recibe ninguna herramienta externa

### Requirement: Las herramientas MCP se ejecutan con su esquema y devuelven texto
El sistema SHALL validar los argumentos contra el esquema que declara el servidor.
SHALL ejecutar la herramienta y SHALL devolver el resultado como texto. SHALL
aplicar el límite de truncado y la sanitización de credenciales. Un error del
servidor SHALL volver al modelo como texto.

#### Scenario: Argumentos válidos
- **WHEN** el modelo llama a una herramienta externa con argumentos válidos
- **THEN** el sistema ejecuta la herramienta y devuelve el resultado como texto

#### Scenario: Argumentos inválidos
- **WHEN** los argumentos no cumplen el esquema del servidor
- **THEN** el sistema devuelve un error como texto y no ejecuta la herramienta

#### Scenario: Resultado truncado
- **WHEN** el resultado supera el límite configurado
- **THEN** el sistema lo trunca y deja un marcador

#### Scenario: Error del servidor
- **WHEN** la herramienta externa falla
- **THEN** el fallo vuelve al modelo como texto

#### Scenario: Sanitización de credenciales
- **WHEN** el resultado contiene una credencial configurada
- **THEN** el texto entregado la tiene redactada

### Requirement: Un fallo de un servidor no detiene la sesión
Si un servidor no arranca, se cae o no responde dentro del timeout, el sistema
SHALL informar el fallo como texto y SHALL NOT terminar el turno. SHALL NOT dejar
procesos huérfanos. El sistema SHALL poder reintentar la conexión en un turno
posterior.

#### Scenario: Servidor que no arranca
- **WHEN** el servidor falla al arrancar
- **THEN** el sistema informa el fallo como texto y la sesión sigue

#### Scenario: Servidor que se cae
- **WHEN** el servidor se cae durante una ejecución
- **THEN** la ejecución devuelve el fallo como texto

#### Scenario: Timeout
- **WHEN** el servidor no responde dentro del timeout
- **THEN** el sistema corta la espera y devuelve el fallo como texto

#### Scenario: Reintento en otro turno
- **WHEN** un servidor falló en un turno anterior
- **THEN** el sistema puede volver a intentar conectarlo en un turno posterior

#### Scenario: Sin procesos huérfanos
- **WHEN** la sesión termina después de conectar servidores
- **THEN** no quedan procesos de esos servidores vivos

### Requirement: Las herramientas MCP respetan permisos y aprobación obligatoria
El sistema SHALL evaluar cada herramienta MCP con una acción de permiso propia y
SHALL usar el servidor y la herramienta como recurso. Sin regla aplicable, SHALL
consultar antes de ejecutar. Una regla `permitir` SHALL ejecutarla sin preguntar.
Una regla `denegar` SHALL impedirla. Una herramienta que declare un motivo de
riesgo SHALL elevarse a aprobación obligatoria.

#### Scenario: Sin regla se consulta
- **WHEN** no hay una regla que alcance la herramienta externa
- **THEN** el sistema consulta antes de ejecutarla

#### Scenario: Regla permitir
- **WHEN** una regla permite usar esa herramienta externa
- **THEN** se ejecuta sin preguntar

#### Scenario: Regla denegar
- **WHEN** una regla deniega usar esa herramienta externa
- **THEN** no se ejecuta y el rechazo vuelve como texto

#### Scenario: Motivo de riesgo
- **WHEN** una herramienta externa declara un motivo de riesgo
- **THEN** el sistema pide aprobación obligatoria con el motivo a la vista

#### Scenario: Sin terminal no se ejecuta lo que requiere aprobación
- **WHEN** una herramienta externa requiere aprobación y no hay cliente interactivo
- **THEN** el sistema no la ejecuta y devuelve el motivo como texto

### Requirement: Un agente solo ve los servidores MCP que declara
El sistema SHALL limitar las herramientas MCP visibles a los servidores que la
definición del agente declara. Sin una declaración explícita, el agente SHALL NOT
recibir herramientas MCP. Una regla `denegar` sobre un servidor SHALL impedir que
sus herramientas se anuncien a ese agente.

#### Scenario: Agente sin declaración
- **WHEN** un agente no declara servidores MCP
- **THEN** no recibe herramientas externas

#### Scenario: Agente con un servidor declarado
- **WHEN** un agente declara un servidor MCP
- **THEN** recibe las herramientas de ese servidor cuando está conectado

#### Scenario: Servidor denegado
- **WHEN** una regla deniega un servidor MCP para un agente
- **THEN** sus herramientas no se anuncian a ese agente
