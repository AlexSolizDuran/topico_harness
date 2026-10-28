# Spec Delta

## MODIFIED Requirements

### Requirement: La interfaz pide aprobación antes de ejecutar una herramienta
La interfaz SHALL mostrar la acción, el recurso, el motivo cuando exista y las
opciones de aprobación cuando una herramienta lo requiera. En una aprobación
normal la interfaz SHALL ofrecer aprobar una vez, aprobar siempre y denegar. En
una aprobación obligatoria SHALL ofrecer solo aprobar una vez y denegar, y SHALL
NOT ofrecer aprobar siempre. La interfaz SHALL NOT ejecutar la herramienta ni
asumir una decisión. Sin terminal interactiva SHALL denegar la solicitud y
explicar el motivo.

#### Scenario: Se pide aprobación con la acción y el recurso
- **WHEN** una herramienta requiere aprobación y declara un motivo
- **THEN** la interfaz muestra la acción, el recurso, el motivo y las opciones

#### Scenario: Una aprobación obligatoria ofrece dos opciones
- **WHEN** la aprobación es obligatoria
- **THEN** la interfaz ofrece aprobar una vez y denegar, y no ofrece aprobar siempre

#### Scenario: Una aprobación normal ofrece tres opciones
- **WHEN** la aprobación no es obligatoria
- **THEN** la interfaz ofrece aprobar una vez, aprobar siempre y denegar

#### Scenario: Aprobar una vez ejecuta solo esa solicitud
- **WHEN** la persona elige aprobar una vez
- **THEN** la herramienta se ejecuta y la siguiente solicitud vuelve a consultar

#### Scenario: Aprobar siempre deja de preguntar para ese patrón
- **WHEN** la persona elige aprobar siempre en una aprobación normal
- **THEN** la interfaz ejecuta la solicitud y no vuelve a preguntar por el patrón guardado

#### Scenario: Denegar devuelve el rechazo y no ejecuta
- **WHEN** la persona elige denegar
- **THEN** la herramienta no se ejecuta y el rechazo vuelve al modelo como texto

#### Scenario: Sin terminal interactiva no se aprueba nada
- **WHEN** una herramienta requiere aprobación y no hay terminal interactiva
- **THEN** la interfaz no la ejecuta y el motivo vuelve al modelo como texto
