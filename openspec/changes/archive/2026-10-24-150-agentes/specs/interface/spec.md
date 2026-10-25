# Spec Delta

## MODIFIED Requirements

### Requirement: La interfaz muestra el estado de la sesión
El sistema SHALL mostrar el modelo activo, el agente activo, el directorio de
trabajo y si hay un turno en curso. El sistema SHALL actualizar ese estado cuando
cambie el modelo, cuando cambie el agente o cuando empiece o termine un turno. El
sistema SHALL NOT presentar el turno como inactivo mientras siga en curso.

#### Scenario: Sesión lista
- **WHEN** no hay un turno en curso
- **THEN** la interfaz muestra el modelo, el directorio y que está lista

#### Scenario: Sesión trabajando
- **WHEN** hay un turno en curso
- **THEN** la interfaz muestra que está trabajando y no la presenta como lista

#### Scenario: La barra muestra el agente activo
- **WHEN** la sesión tiene un agente activo
- **THEN** la barra de estado muestra su nombre junto al modelo

## ADDED Requirements

### Requirement: La interfaz permite cambiar el agente activo
El sistema SHALL permitir elegir el agente activo entre los agentes primarios. El
sistema SHALL ofrecer un atajo para ciclar entre ellos y una lista para elegirlos.
El sistema SHALL NOT ofrecer como agente activo uno que no sea primario. El sistema
SHALL NOT cambiar de agente durante un turno en curso.

#### Scenario: Cambiar de agente con el atajo
- **WHEN** la persona usa el atajo de cambio de agente
- **THEN** el agente activo pasa al siguiente agente primario y la barra lo refleja

#### Scenario: Elegir un agente desde la lista
- **WHEN** la persona abre la lista de agentes y elige uno
- **THEN** la sesión lo activa y conserva el historial

#### Scenario: El agente activo se conserva entre turnos
- **WHEN** un turno termina
- **THEN** el agente activo sigue siendo el mismo que antes del turno
