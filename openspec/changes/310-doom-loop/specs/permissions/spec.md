# Spec Delta

## MODIFIED Requirements

### Requirement: La acción agrupa las herramientas por lo que hacen
El sistema SHALL evaluar el permiso por acción y no por el nombre de la herramienta.
Las acciones SHALL ser leer, buscar archivos, buscar texto, editar, ejecutar,
ejecutar compuesto, ejecutar con redirección, delegar, directorio externo, cargar
skill, ejecutar hook y detectar repetición. La acción de editar SHALL cubrir tanto
escribir como editar un archivo. La acción de ejecutar compuesto SHALL cubrir una
línea que encadena comandos y una invocación a un intérprete que ejecuta código con
una bandera. La acción de ejecutar con redirección SHALL cubrir una línea que
redirija a un archivo, use un heredoc, un herestring o una sustitución de proceso.
La acción de cargar skill SHALL cubrir la entrega del cuerpo de una skill y SHALL
usar su identificador como recurso. La acción de ejecutar hook SHALL cubrir la
ejecución de un hook y SHALL usar el nombre del evento como recurso. La acción de
detectar repetición SHALL cubrir la tercera llamada consecutiva con la misma
herramienta y los mismos argumentos y SHALL usar el nombre de la herramienta como
recurso. La acción SHALL resolverse con los argumentos de la llamada, de modo que
la misma herramienta pueda usar una acción u otra según lo que se le pide.

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

#### Scenario: Skill y hook tienen acciones propias
- **WHEN** una regla deniega cargar una skill concreta y otra permite ejecutar un hook concreto
- **THEN** la skill se deniega y el hook se ejecuta, cada uno evaluado con su propia acción y su propio recurso

#### Scenario: La repetición tiene una acción propia
- **WHEN** el núcleo detecta la tercera llamada idéntica
- **THEN** el permiso se evalúa con la acción de detectar repetición y el nombre de la herramienta como recurso

### Requirement: Hay operaciones que siempre piden aprobación
El sistema SHALL pedir aprobación cuando una herramienta declare un motivo de
riesgo o el núcleo detecte una repetición idéntica, aunque una regla `permitir` o
una aprobación guardada coincidan. La aprobación SHALL ser obligatoria y SHALL
mostrar el motivo. Si la herramienta repetida también declara un motivo de riesgo,
el sistema SHALL emitir una sola solicitud que incluya ambos motivos. Una regla
`denegar` configurada SHALL impedir la operación sin preguntar. Sin cliente
interactivo la operación SHALL denegarse. La aprobación obligatoria SHALL NOT
guardar una regla.

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

#### Scenario: Una regla permitir no salta la aprobación de repetición
- **WHEN** una regla permite detectar repetición y el núcleo detecta la tercera llamada idéntica
- **THEN** el sistema pide aprobación obligatoria igualmente

#### Scenario: Una aprobación guardada no salta la aprobación de repetición
- **WHEN** existe una aprobación guardada que coincide con la herramienta y el núcleo detecta la tercera llamada idéntica
- **THEN** el sistema vuelve a pedir aprobación

#### Scenario: Una regla denegar impide la repetición sin preguntar
- **WHEN** una regla configurada deniega detectar repetición para la herramienta
- **THEN** el sistema deniega la llamada repetida sin pedir aprobación

#### Scenario: La aprobación combinada muestra ambos motivos
- **WHEN** la tercera llamada idéntica usa una herramienta que también declara un motivo de riesgo
- **THEN** el sistema emite una sola solicitud obligatoria con el motivo de repetición y el motivo de la herramienta

#### Scenario: La aprobación de repetición no guarda una regla
- **WHEN** la persona aprueba una vez una solicitud de repetición
- **THEN** el sistema ejecuta esa llamada y no guarda una regla de permitir

#### Scenario: Sin terminal no se ejecuta la repetición
- **WHEN** la tercera llamada idéntica requiere aprobación y no hay cliente interactivo
- **THEN** el sistema no la ejecuta y devuelve el motivo como texto
