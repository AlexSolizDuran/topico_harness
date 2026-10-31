# Spec Delta

## MODIFIED Requirements

### Requirement: La acción agrupa las herramientas por lo que hacen
El sistema SHALL evaluar el permiso por acción y no por el nombre de la herramienta.
Las acciones SHALL ser leer, buscar archivos, buscar texto, editar, ejecutar,
ejecutar compuesto, ejecutar con redirección, delegar, directorio externo, cargar
skill y ejecutar hook. La acción de editar SHALL cubrir tanto escribir como editar
un archivo. La acción de ejecutar compuesto SHALL cubrir una línea que encadena
comandos y una invocación a un intérprete que ejecuta código con una bandera. La
acción de ejecutar con redirección SHALL cubrir una línea que redirija a un archivo,
use un heredoc, un herestring o una sustitución de proceso. La acción de cargar
skill SHALL cubrir la entrega del cuerpo de una skill y SHALL usar su identificador
como recurso. La acción de ejecutar hook SHALL cubrir la ejecución de un hook y
SHALL usar el nombre del evento como recurso. La acción SHALL resolverse con los
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

#### Scenario: Skill y hook tienen acciones propias
- **WHEN** una regla deniega cargar una skill concreta y otra permite ejecutar un hook concreto
- **THEN** la skill se deniega y el hook se ejecuta, cada uno evaluado con su propia acción y su propio recurso
