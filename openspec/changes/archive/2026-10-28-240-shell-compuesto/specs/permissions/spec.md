# Spec Delta

## MODIFIED Requirements

### Requirement: La acción agrupa las herramientas por lo que hacen
El sistema SHALL evaluar el permiso por acción y no por el nombre de la herramienta.
Las acciones SHALL ser leer, buscar archivos, buscar texto, editar, ejecutar,
ejecutar compuesto, delegar y directorio externo. La acción de editar SHALL cubrir
tanto escribir como editar un archivo. La acción de ejecutar compuesto SHALL cubrir
una línea que encadena comandos y una invocación a un intérprete que ejecuta código
con una bandera. La acción SHALL resolverse con los argumentos de la llamada, de
modo que la misma herramienta pueda usar una acción u otra según lo que se le pide.

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

---

### Requirement: La política base permite y protege los secretos
El sistema SHALL partir de una política base que permita toda acción, consulte al
leer un archivo `.env` o `*.env.*`, permita leer `*.env.example`, y consulte toda
acción de ejecutar compuesto. Las reglas globales y las del agente SHALL aplicarse
después de la base. Una ruta fuera del proyecto SHALL evaluarse contra la acción de
directorio externo antes que contra leer o editar.

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
- **WHEN** el modelo lee o edita una ruta fuera del proyecto y no hay una regla de directorio externo
- **THEN** la operación se permite sin consultar

#### Scenario: Un comando compuesto consulta aunque la base permita ejecutar
- **WHEN** el modelo solicita una línea compuesta y no hay una regla que la permita
- **THEN** el sistema consulta antes de ejecutarla y muestra la línea completa

#### Scenario: Un comando simple no consulta
- **WHEN** el modelo solicita una invocación simple y no hay una regla que la restrinja
- **THEN** el sistema la ejecuta sin consultar
