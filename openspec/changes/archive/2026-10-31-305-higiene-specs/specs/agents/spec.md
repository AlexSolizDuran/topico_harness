# Spec Delta

## MODIFIED Requirements

### Requirement: Cada agente se define como un dato declarativo
El sistema SHALL obtener las definiciones de agente de un archivo de configuración
del proyecto. Cada definición SHALL declarar nombre, descripción, modo y conjunto
de herramientas, y MAY declarar un prompt propio, un modelo y una lista de reglas
de permiso. Las reglas de permiso de un agente SHALL usar el mismo formato que las
reglas del proyecto y SHALL agregarse después de las globales. El sistema SHALL
leer el archivo al arrancar. El sistema SHALL NOT requerir cambios en el código del
bucle para agregar un agente.

#### Scenario: Agregar un agente no requiere tocar el bucle
- **WHEN** se agrega una definición válida al archivo de agentes
- **THEN** la sesión la ofrece y un turno puede usarla sin cambios en el código del bucle

#### Scenario: El archivo de agentes se lee al arrancar
- **WHEN** la sesión arranca con un archivo que declara agentes
- **THEN** las definiciones están disponibles antes del primer turno

#### Scenario: Un agente declara su modelo
- **WHEN** una definición declara un modelo de la configuración
- **THEN** el agente usa ese modelo en sus turnos

#### Scenario: Un agente declara sus permisos
- **WHEN** una definición declara una lista de reglas de permiso válida
- **THEN** la definición cargada conserva esas reglas y la sesión las aplica después de las globales

### Requirement: Una definición inválida falla al arrancar con un mensaje explícito
El sistema SHALL rechazar al arrancar una definición con nombre vacío o repetido,
un modo desconocido, una herramienta que no existe en el catálogo, un modelo que
no existe en la configuración, o una regla de permiso con forma inválida, con un
mensaje que identifique la definición y el problema. El sistema SHALL rechazar un
conjunto sin ningún agente primario. El sistema SHALL NOT ignorar en silencio una
definición inválida.

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

#### Scenario: Una regla de permiso inválida falla al arrancar
- **WHEN** una definición declara una regla de permiso sin acción, sin recurso o con un efecto desconocido
- **THEN** el arranque falla con un mensaje que nombra la definición y la posición de la regla
