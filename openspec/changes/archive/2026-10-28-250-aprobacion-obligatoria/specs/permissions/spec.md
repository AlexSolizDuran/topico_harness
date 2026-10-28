# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Una aprobación espera la decisión y ofrece tres salidas`
- TO: `### Requirement: Una aprobación espera la decisión y ofrece las salidas que corresponden`

## MODIFIED Requirements

### Requirement: La acción agrupa las herramientas por lo que hacen
El sistema SHALL evaluar el permiso por acción y no por el nombre de la herramienta.
Las acciones SHALL ser leer, buscar archivos, buscar texto, editar, ejecutar,
ejecutar compuesto, ejecutar con redirección, delegar y directorio externo. La
acción de editar SHALL cubrir tanto escribir como editar un archivo. La acción de
ejecutar compuesto SHALL cubrir una línea que encadena comandos y una invocación a
un intérprete que ejecuta código con una bandera. La acción de ejecutar con
redirección SHALL cubrir una línea que redirija a un archivo, use un heredoc, un
herestring o una sustitución de proceso. La acción SHALL resolverse con los
argumentos de la llamada, de modo que la misma herramienta pueda usar una acción u
otra según lo que se le pide.

#### Scenario: Escribir y editar comparten la acción edit
- **WHEN** una regla permite la acción de editar
- **THEN** tanto escribir como editar un archivo quedan permitidos

#### Scenario: Buscar archivos y buscar texto tienen acciones propias
- **WHEN** una regla permite leer pero no busca
- **THEN** buscar archivos y buscar texto se evalúan con su propia acción

#### Scenario: La delegación usa la acción subagent
- **WHEN** el modelo delega en un subagente
- **THEN** el permiso se evalúa con la acción de delegar y el nombre del subagente como recurso

#### Scenario: Ejecutar y ejecutar compuesto son acciones distintas
- **WHEN** una regla permite ejecutar pero no ejecutar compuesto
- **THEN** un comando simple se permite y una línea compuesta se consulta

#### Scenario: Ejecutar con redirección es una acción propia
- **WHEN** una regla permite ejecutar pero no ejecutar con redirección
- **THEN** un comando simple se permite y una línea con redirección se consulta

---

### Requirement: La política base permite y protege los secretos
El sistema SHALL partir de una política base que permita toda acción, consulte al
leer un archivo `.env` o `*.env.*`, permita leer `*.env.example`, consulte toda
acción de ejecutar compuesto y toda acción de ejecutar con redirección. Las reglas
globales y las del agente SHALL aplicarse después de la base. Una ruta fuera del
proyecto SHALL evaluarse contra la acción de directorio externo antes que contra
leer o editar. La política base SHALL NOT decidir el riesgo de una operación: una
herramienta puede elevarla a aprobación obligatoria, y ninguna regla de la base
SHALL satisfacer esa aprobación. Una regla `denegar` de directorio externo SHALL
impedir la operación.

#### Scenario: Un archivo común se lee sin preguntar
- **WHEN** el modelo lee un archivo que no es de entorno
- **THEN** la lectura se ejecuta sin consultar

#### Scenario: Un archivo .env consulta
- **WHEN** el modelo lee un archivo `.env`
- **THEN** el sistema consulta antes de leerlo

#### Scenario: Un archivo .env.example se permite
- **WHEN** el modelo lee un archivo `*.env.example`
- **THEN** la lectura se permite sin consultar

#### Scenario: Una ruta externa se permite por defecto
- **WHEN** el modelo lee o edita una ruta fuera del proyecto y la herramienta no declara un motivo
- **THEN** el sistema la permite por defecto, salvo que una regla de directorio externo lo deniegue

#### Scenario: Un comando compuesto consulta aunque la base permita ejecutar
- **WHEN** el modelo solicita una línea compuesta y no hay una regla que la permita
- **THEN** el sistema consulta antes de ejecutarla y muestra la línea completa

#### Scenario: Una redirección consulta aunque la base permita ejecutar
- **WHEN** el modelo solicita una línea con redirección
- **THEN** el sistema consulta antes de ejecutarla y muestra la línea completa

#### Scenario: Un comando simple no consulta
- **WHEN** el modelo solicita una invocación simple y no hay una regla que la restrinja
- **THEN** el sistema la ejecuta sin consultar

---

### Requirement: Una aprobación espera la decisión y ofrece las salidas que corresponden
El sistema SHALL esperar la decisión cuando el efecto sea consultar, sin ejecutar
la herramienta. En una aprobación normal la decisión SHALL ser aprobar una vez,
aprobar siempre o denegar. Aprobar siempre SHALL guardar una regla de permitir con
alcance de proyecto y con el patrón que propone la herramienta. En una aprobación
obligatoria la decisión SHALL ser aprobar una vez o denegar, y SHALL NOT guardar
una regla. Una regla guardada SHALL NOT pisar una denegación configurada. Denegar
SHALL rechazar la solicitud pendiente y las demás pendientes de la sesión.

#### Scenario: Aprobar una vez ejecuta solo esa solicitud
- **WHEN** la persona aprueba una vez una solicitud
- **THEN** el sistema ejecuta esa solicitud y vuelve a consultar la siguiente

#### Scenario: Aprobar siempre guarda una regla del proyecto
- **WHEN** la persona aprueba siempre una solicitud normal
- **THEN** el sistema guarda una regla de permitir con el patrón propuesto y deja de consultar ese patrón

#### Scenario: Una aprobación obligatoria no ofrece aprobar siempre
- **WHEN** una operación tiene un motivo de riesgo
- **THEN** la decisión solo puede ser aprobar una vez o denegar

#### Scenario: Aprobar siempre en una obligatoria no guarda una regla
- **WHEN** un cliente envía aprobar siempre para una aprobación obligatoria
- **THEN** el sistema ejecuta solo esa solicitud y no guarda una regla

#### Scenario: Una aprobación guardada no pisa un deny configurado
- **WHEN** existe una denegación configurada para el recurso
- **THEN** la aprobación guardada no la anula y la operación sigue denegada

#### Scenario: Denegar rechaza las demás solicitudes pendientes
- **WHEN** la persona deniega una solicitud y hay otras pendientes en la sesión
- **THEN** el sistema rechaza también las demás pendientes

## ADDED Requirements

### Requirement: Hay operaciones que siempre piden aprobación
El sistema SHALL pedir aprobación cuando una herramienta declare un motivo de
riesgo, aunque una regla `permitir` o una aprobación guardada coincidan. La
aprobación SHALL ser obligatoria y SHALL mostrar el motivo. Una regla `denegar`
configurada SHALL impedir la operación sin preguntar. Sin cliente interactivo la
operación SHALL denegarse. La aprobación obligatoria SHALL NOT guardar una regla.

#### Scenario: Una regla permitir no salta la aprobación
- **WHEN** una regla permite la acción y la herramienta declara un motivo de riesgo
- **THEN** el sistema pide aprobación obligatoria igualmente

#### Scenario: Una aprobación guardada no salta la aprobación
- **WHEN** existe una aprobación guardada que coincide con el recurso y la herramienta declara un motivo
- **THEN** el sistema vuelve a pedir aprobación

#### Scenario: Una regla denegar impide sin preguntar
- **WHEN** una regla configurada deniega la acción y la herramienta declara un motivo
- **THEN** el sistema deniega la operación sin pedir aprobación

#### Scenario: El motivo se muestra
- **WHEN** una operación pide aprobación obligatoria
- **THEN** la solicitud incluye el motivo que declaró la herramienta

#### Scenario: Sin terminal no se ejecuta lo obligatorio
- **WHEN** una operación pide aprobación obligatoria y no hay cliente interactivo
- **THEN** el sistema no la ejecuta y devuelve el motivo como texto
