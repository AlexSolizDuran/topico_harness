# Spec Delta

## ADDED Requirements

### Requirement: La salida de la herramienta de ejecución se entrega como cola
Cuando la salida de la herramienta de ejecución supere el límite, el sistema
SHALL entregar al modelo los últimos N caracteres y una marca con lo omitido y
cómo recuperar el resto. La cola SHALL ser por comando y SHALL NOT mezclar
salidas. Una salida dentro del límite SHALL entregarse completa. Si el comando
falla, la cola SHALL conservar el final del error. La marca SHALL distinguir la
cola del modelo de la salida completa de la interfaz.

#### Scenario: Salida grande
- **WHEN** un comando produce una salida mayor que el límite configurado
- **THEN** el modelo recibe los últimos N caracteres y una marca con la cantidad omitida

#### Scenario: Dos comandos no se mezclan
- **WHEN** dos comandos del mismo turno producen salidas largas
- **THEN** la cola de cada comando se entrega por separado y no se mezcla con la del otro

#### Scenario: Salida dentro del límite
- **WHEN** un comando produce una salida menor o igual al límite
- **THEN** el modelo recibe la salida completa

#### Scenario: El fallo conserva el final del error
- **WHEN** un comando falla y su salida de error supera el límite
- **THEN** la cola entregada al modelo conserva el final de la salida de error

#### Scenario: El marcador dice cuánto se omitió y cómo recuperar
- **WHEN** el sistema entrega una cola al modelo
- **THEN** la marca indica la cantidad omitida y que la salida completa está disponible en la interfaz
