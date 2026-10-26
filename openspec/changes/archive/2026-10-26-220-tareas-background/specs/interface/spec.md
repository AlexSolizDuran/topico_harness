# Spec Delta

## ADDED Requirements

### Requirement: La interfaz muestra las tareas en background activas
La interfaz SHALL mostrar cuántas tareas en background siguen en curso. Cuando la
última termina, el indicador SHALL desaparecer o quedar en cero. La espera al cerrar
el turno SHALL ser visible como un aviso.

#### Scenario: La barra muestra tareas en curso
- **WHEN** hay una o más tareas en background en curso
- **THEN** la barra de estado muestra su cantidad

#### Scenario: La espera al cerrar el turno es visible
- **WHEN** el turno del padre termina y espera tareas en background
- **THEN** la interfaz muestra un aviso de espera
