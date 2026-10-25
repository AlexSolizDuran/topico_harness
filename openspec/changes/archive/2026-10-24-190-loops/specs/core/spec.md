# Spec Delta

## ADDED Requirements

### Requirement: La repetición idéntica consecutiva no se ejecuta
El sistema SHALL contar las llamadas consecutivas con el mismo nombre de
herramienta y los mismos argumentos, comparando los argumentos sin depender del
orden de sus claves. Al llegar a tres, SHALL NOT ejecutar la tercera y SHALL
devolver al modelo un mensaje que indique la repetición y que el resultado anterior
no cambió. Toda llamada idéntica posterior SHALL NOT ejecutarse mientras el conteo
no se reinicie. El sistema SHALL reiniciar el conteo cuando cambie la herramienta,
cambie un argumento o haya otra llamada en el medio. El bloqueo SHALL NOT terminar
el turno y SHALL registrar su resultado junto a la llamada.

#### Scenario: La tercera llamada idéntica no se ejecuta
- **WHEN** el modelo repite la misma herramienta con los mismos argumentos por tercera vez consecutiva
- **THEN** el sistema no la ejecuta y le devuelve un mensaje que indica la repetición

#### Scenario: Dos llamadas idénticas se ejecutan
- **WHEN** el modelo repite la misma herramienta con los mismos argumentos por segunda vez consecutiva
- **THEN** el sistema la ejecuta normalmente

#### Scenario: Cambiar un argumento reinicia el conteo
- **WHEN** el modelo llama a la misma herramienta con un argumento distinto
- **THEN** el sistema ejecuta la llamada y reinicia el conteo

#### Scenario: Otra llamada en el medio reinicia el conteo
- **WHEN** entre dos llamadas idénticas hay una llamada a otra herramienta
- **THEN** el sistema reinicia el conteo y la llamada idéntica se ejecuta

#### Scenario: El turno continúa después del bloqueo
- **WHEN** el sistema bloquea una llamada repetida
- **THEN** el modelo recibe el mensaje y el turno sigue en curso

#### Scenario: El bloqueo queda en el historial junto a su llamada
- **WHEN** el turno termina después de un bloqueo por repetición
- **THEN** el historial contiene el mensaje de bloqueo junto a la llamada que lo produjo
