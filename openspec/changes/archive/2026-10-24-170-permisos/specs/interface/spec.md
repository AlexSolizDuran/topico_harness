# Spec Delta

## MODIFIED Requirements

### Requirement: La interfaz muestra el estado de la sesión
El sistema SHALL mostrar el modelo activo, el agente activo, el directorio de
trabajo y si hay un turno en curso. El sistema SHALL actualizar ese estado cuando
cambie el modelo, cuando cambie el agente o cuando empiece o termine un turno. El
sistema SHALL mostrar cuando el turno espera una aprobación. El sistema SHALL NOT
presentar el turno como inactivo mientras siga en curso.

#### Scenario: Sesión lista
- **WHEN** no hay un turno en curso
- **THEN** la interfaz muestra el modelo, el directorio y que está lista

#### Scenario: Sesión trabajando
- **WHEN** hay un turno en curso
- **THEN** la interfaz muestra que está trabajando y no la presenta como lista

#### Scenario: La barra muestra el agente activo
- **WHEN** la sesión tiene un agente activo
- **THEN** la barra de estado muestra su nombre junto al modelo

#### Scenario: La barra muestra la espera de aprobación
- **WHEN** el turno espera una aprobación
- **THEN** la barra de estado muestra que está esperando una decisión

## ADDED Requirements

### Requirement: La interfaz pide aprobación antes de ejecutar una herramienta
La interfaz SHALL mostrar la acción, el recurso y las opciones de aprobación cuando
una herramienta lo requiera. La interfaz SHALL ofrecer aprobar una vez, aprobar
siempre y denegar. La interfaz SHALL NOT ejecutar la herramienta ni asumir una
decisión. Sin terminal interactiva SHALL denegar la solicitud y explicar el motivo.

#### Scenario: Se pide aprobación con la acción y el recurso
- **WHEN** una herramienta requiere aprobación
- **THEN** la interfaz muestra la acción, el recurso y las tres opciones

#### Scenario: Aprobar una vez ejecuta solo esa solicitud
- **WHEN** la persona elige aprobar una vez
- **THEN** la herramienta se ejecuta y la siguiente solicitud vuelve a consultar

#### Scenario: Aprobar siempre deja de preguntar para ese patrón
- **WHEN** la persona elige aprobar siempre
- **THEN** la interfaz ejecuta la solicitud y no vuelve a preguntar por el patrón guardado

#### Scenario: Denegar devuelve el rechazo y no ejecuta
- **WHEN** la persona elige denegar
- **THEN** la herramienta no se ejecuta y el rechazo vuelve al modelo como texto

#### Scenario: Sin terminal interactiva no se aprueba nada
- **WHEN** una herramienta requiere aprobación y no hay terminal interactiva
- **THEN** la interfaz no la ejecuta y el motivo vuelve al modelo como texto
