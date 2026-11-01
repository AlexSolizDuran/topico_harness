# Spec Delta

## ADDED Requirements

### Requirement: La interfaz conserva la salida completa de la herramienta de ejecución
La interfaz SHALL conservar y mostrar la salida completa de la herramienta de
ejecución, aunque el modelo reciba solo una cola. La salida completa SHALL quedar
disponible para la persona después de que el turno termine o se cancele. La
interfaz SHALL NOT presentar la cola del modelo como si fuera la salida completa.

#### Scenario: Salida grande
- **WHEN** el modelo recibe una cola de una salida larga
- **THEN** la interfaz conserva y muestra la salida completa

#### Scenario: Salida pequeña
- **WHEN** la salida cabe en el límite
- **THEN** la interfaz y el modelo reciben la misma salida completa

#### Scenario: La salida completa sobrevive al turno
- **WHEN** el turno termina o se cancela después de una salida larga
- **THEN** la persona puede seguir consultando la salida completa

#### Scenario: La interfaz no confunde la cola con la salida completa
- **WHEN** la interfaz muestra el resultado de una ejecución larga
- **THEN** indica que el modelo recibió solo una cola y no presenta esa cola como el total
