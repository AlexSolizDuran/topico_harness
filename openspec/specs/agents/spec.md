# agents Specification

## Purpose
Convierte el perfil del agente en un dato: nombre, descripción, modo y conjunto de
herramientas. Permite tener un agente que hace el trabajo y otro que solo lee y
analiza, sin tocar el bucle. Es la base sobre la que se apoyan los subagentes y los
permisos por agente.

## Requirements

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

### Requirement: Un agente solo recibe las herramientas que declara
El sistema SHALL enviar al provider únicamente las definiciones de herramienta del
agente activo. El sistema SHALL rechazar la ejecución de una herramienta que no
esté en la definición del agente activo, devolviendo el rechazo como texto. El
sistema SHALL NOT confiar en que el modelo respete la lista de herramientas.

#### Scenario: La petición solo incluye las herramientas del agente
- **WHEN** el agente activo declara un subconjunto de las herramientas disponibles
- **THEN** la petición al provider incluye solo ese subconjunto

#### Scenario: Una herramienta no declarada se rechaza aunque el modelo la pida
- **WHEN** el modelo solicita una herramienta que el agente activo no declara
- **THEN** el sistema no la ejecuta y devuelve el rechazo al modelo como texto

#### Scenario: El agente completo ve todas las herramientas disponibles
- **WHEN** el agente activo declara todas las herramientas disponibles
- **THEN** la petición al provider incluye todas

---

### Requirement: El agente activo se conserva y cambia de forma atómica
El sistema SHALL mantener un agente activo por sesión. Cambiar de agente SHALL
conservar el historial y el modelo activo. El sistema SHALL NOT cambiar de agente
mientras hay un turno en curso. La sesión SHALL arrancar con el agente primario por
defecto.

#### Scenario: Cambiar de agente conserva el historial y el modelo
- **WHEN** la persona cambia de agente después de un turno
- **THEN** el historial y el modelo activo siguen siendo los mismos

#### Scenario: No se cambia de agente durante un turno en curso
- **WHEN** la persona intenta cambiar de agente mientras hay un turno en curso
- **THEN** el sistema rechaza el cambio con un mensaje y el turno continúa

#### Scenario: La sesión arranca con el agente primario por defecto
- **WHEN** la sesión arranca sin indicar un agente
- **THEN** el agente activo es el primario declarado por defecto

---

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

### Requirement: Sin configuración el sistema ofrece un agente completo y uno de solo lectura
El sistema SHALL ofrecer, cuando no existe archivo de agentes, un agente que puede
usar todas las herramientas disponibles y un agente de solo lectura que puede leer
y buscar pero no escribir ni ejecutar comandos. El sistema SHALL NOT requerir
configuración para el primer arranque.

#### Scenario: Sin archivo de agentes hay uno completo y uno de lectura
- **WHEN** la sesión arranca en un proyecto sin archivo de agentes
- **THEN** el sistema ofrece un agente con todas las herramientas y uno de solo lectura

#### Scenario: El agente de solo lectura no incluye escritura ni ejecución
- **WHEN** el agente de solo lectura está activo
- **THEN** su conjunto de herramientas no incluye escribir, editar ni ejecutar comandos
