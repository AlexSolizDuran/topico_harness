# Spec Delta

## ADDED Requirements

### Requirement: Una sesión se puede ramificar desde un turno anterior
El sistema SHALL crear una sesión nueva a partir del historial de otra sesión
hasta después del turno indicado. La sesión original SHALL NOT modificarse. La
rama SHALL registrar en sus metadatos la sesión de origen y el turno de corte. Si
el turno no existe en la sesión de origen, SHALL devolver un error como texto y
SHALL NOT crear la rama.

#### Scenario: Ramificar desde un turno existente
- **WHEN** el usuario pide una rama desde un turno que existe en la sesión activa
- **THEN** se crea una sesión nueva con el historial hasta ese turno y la original queda intacta

#### Scenario: Ramificar desde antes del primer turno
- **WHEN** el usuario pide una rama desde el turno cero
- **THEN** la sesión nueva arranca sin historial

#### Scenario: Ramificar desde un turno inexistente
- **WHEN** el usuario pide una rama desde un turno que la sesión no tiene
- **THEN** el sistema no crea la rama y devuelve un error

---

### Requirement: Se puede buscar texto en las sesiones guardadas
El sistema SHALL buscar un texto en el historial de las sesiones del proyecto y
SHALL devolver las que lo contienen, ordenadas por actualización descendente, con
la cantidad de coincidencias y un fragmento. Si no hay coincidencias SHALL devolver
una lista vacía. Ante un texto vacío SHALL devolver un error como texto.

#### Scenario: Buscar un texto presente
- **WHEN** el usuario busca un texto que aparece en una o más sesiones
- **THEN** recibe esas sesiones con la cantidad de coincidencias y un fragmento

#### Scenario: Buscar un texto ausente
- **WHEN** el usuario busca un texto que no aparece en ninguna sesión
- **THEN** recibe una lista vacía

#### Scenario: Buscar con texto vacío
- **WHEN** el usuario busca sin texto
- **THEN** recibe un mensaje de error
