# Spec Delta

## ADDED Requirements

### Requirement: La interfaz muestra las herramientas de una tanda
La interfaz SHALL mostrar una tarjeta por cada llamada de la tanda en cuanto la
tanda empieza. La interfaz SHALL completar cada tarjeta cuando esa llamada termina,
en cualquier orden. La interfaz SHALL NOT reordenar las tarjetas según el orden de
finalización.

#### Scenario: Una tanda muestra todas sus tarjetas al empezar
- **WHEN** el turno ejecuta una tanda de varias llamadas
- **THEN** la interfaz muestra todas las tarjetas desde el inicio de la tanda

#### Scenario: Las tarjetas se completan a medida que terminan
- **WHEN** una llamada de la tanda termina antes que otra
- **THEN** su tarjeta se completa primero

#### Scenario: El orden de las tarjetas es el de las llamadas
- **WHEN** las llamadas de una tanda terminan en orden distinto al pedido
- **THEN** las tarjetas conservan el orden en que el modelo pidió las llamadas
