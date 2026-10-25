# Spec Delta

## MODIFIED Requirements

### Requirement: Cada agente se define como un dato declarativo
El sistema SHALL obtener las definiciones de agente de un archivo de configuración
del proyecto. Cada definición SHALL declarar nombre, descripción, modo y conjunto
de herramientas, y MAY declarar un prompt propio y un modelo. El sistema SHALL leer
el archivo al arrancar. El sistema SHALL NOT requerir cambios en el código del bucle
para agregar un agente.

#### Scenario: Agregar un agente no requiere tocar el bucle
- **WHEN** se agrega una definición válida al archivo de agentes
- **THEN** la sesión la ofrece y un turno puede usarla sin cambios en el código del bucle

#### Scenario: El archivo de agentes se lee al arrancar
- **WHEN** la sesión arranca con un archivo que declara agentes
- **THEN** las definiciones están disponibles antes del primer turno

#### Scenario: Un agente declara su modelo
- **WHEN** una definición declara un modelo de la configuración
- **THEN** el agente usa ese modelo en sus turnos

### Requirement: El modo determina cómo se invoca un agente
El sistema SHALL distinguir tres modos: primario, subagente y ambos. Un agente
primario SHALL poder ser el agente activo de la sesión. Un agente subagente SHALL
NOT poder ser el agente activo: solo otro agente podrá lanzarlo. Un agente de modo
ambos SHALL poder ser activo y también lanzado por otro agente. Un agente primario
SHALL NOT poder lanzarse como subagente.

#### Scenario: Un agente primario se ofrece en la sesión
- **WHEN** una definición declara el modo primario
- **THEN** el sistema la ofrece como agente activo

#### Scenario: Un subagente no se ofrece como agente principal
- **WHEN** una definición declara el modo subagente
- **THEN** el sistema no la ofrece como agente activo de la sesión

#### Scenario: Un agente de modo ambos se ofrece en la sesión
- **WHEN** una definición declara el modo ambos
- **THEN** el sistema la ofrece como agente activo

#### Scenario: Un agente primario no se lanza como subagente
- **WHEN** el modelo intenta delegar en un agente de modo primario
- **THEN** el sistema rechaza la delegación como texto

### Requirement: Una definición inválida falla al arrancar con un mensaje explícito
El sistema SHALL rechazar al arrancar una definición con nombre vacío o repetido,
un modo desconocido, una herramienta que no existe en el catálogo, o un modelo que
no existe en la configuración, con un mensaje que identifique la definición y el
problema. El sistema SHALL rechazar un conjunto sin ningún agente primario. El
sistema SHALL NOT ignorar en silencio una definición inválida.

#### Scenario: Una herramienta inexistente falla al arrancar
- **WHEN** una definición declara una herramienta que no está en el catálogo
- **THEN** el arranque falla con un mensaje que nombra la definición y la herramienta

#### Scenario: Un modo desconocido falla al arrancar
- **WHEN** una definición declara un modo que no existe
- **THEN** el arranque falla con un mensaje que nombra la definición y el modo

#### Scenario: Un nombre repetido falla al arrancar
- **WHEN** dos definiciones del archivo declaran el mismo nombre
- **THEN** el arranque falla con un mensaje que nombra el duplicado

#### Scenario: Sin ningún agente primario falla al arrancar
- **WHEN** el conjunto de agentes no tiene ningún agente primario ni de modo ambos
- **THEN** el arranque falla con un mensaje que explica que no hay agente activo posible

#### Scenario: Un modelo inexistente falla al arrancar
- **WHEN** una definición declara un modelo que no está en la configuración
- **THEN** el arranque falla con un mensaje que nombra la definición y el modelo
