# Spec Delta

## MODIFIED Requirements

### Requirement: Las herramientas se despachan contra un registro de datos
El sistema SHALL resolver cada herramienta solicitada por nombre contra un registro
que asocia un nombre con su esquema y su forma de ejecutarla. El sistema SHALL NOT
resolver herramientas mediante una condicional sobre su nombre. El sistema SHALL
permitir registrar una herramienta nueva sin modificar el bucle. Antes de ejecutar
una herramienta, el sistema SHALL consultar su permiso. Con efecto de permitir SHALL
ejecutarla; con efecto de denegar SHALL NOT ejecutarla y SHALL devolver el rechazo
al modelo como texto; con efecto de consultar SHALL esperar la decisión sin
ejecutarla.

#### Scenario: Una herramienta nueva se agrega sin tocar el bucle
- **WHEN** se da de alta una herramienta nueva en el registro
- **THEN** el modelo puede solicitarla sin que el bucle cambie

#### Scenario: El nombre se resuelve contra el registro
- **WHEN** el modelo solicita una herramienta cuyo nombre está en el registro
- **THEN** el sistema ejecuta la función asociada a ese nombre

#### Scenario: Una herramienta permitida se ejecuta
- **WHEN** la regla que gana permite la acción de la herramienta
- **THEN** el sistema la ejecuta sin consultar

#### Scenario: Una herramienta denegada no se ejecuta
- **WHEN** la regla que gana deniega la acción de la herramienta
- **THEN** el sistema no la ejecuta y devuelve el rechazo al modelo

#### Scenario: Una herramienta en espera no se ejecuta hasta que se decida
- **WHEN** la regla que gana consulta la acción de la herramienta
- **THEN** el sistema espera la decisión y no la ejecuta mientras espera

## ADDED Requirements

### Requirement: La espera de aprobación no rompe el turno
El sistema SHALL mantener el turno en curso mientras espera una aprobación. El
sistema SHALL cancelar la espera cuando se cancela el turno. El sistema SHALL NOT
agregar al historial un resultado sin su llamada. Un rechazo SHALL volver al modelo
como resultado y el turno SHALL continuar.

#### Scenario: Cancelar mientras se espera termina el turno cancelado
- **WHEN** la persona cancela el turno mientras espera una aprobación
- **THEN** el sistema cancela la espera y termina el turno como cancelado

#### Scenario: Un rechazo vuelve al modelo y el turno continúa
- **WHEN** la persona deniega una solicitud
- **THEN** el modelo recibe el rechazo como resultado y sigue su turno

#### Scenario: La espera no deja un resultado huérfano
- **WHEN** el turno termina después de una espera
- **THEN** el historial contiene cada resultado junto a su llamada
