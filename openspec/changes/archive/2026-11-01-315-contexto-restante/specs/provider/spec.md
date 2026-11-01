# Spec Delta

## ADDED Requirements

### Requirement: El prefijo de la petición se mantiene estable
El sistema SHALL enviar el prompt de sistema al inicio de cada petición y SHALL
NOT modificarlo dentro de un mismo turno. El sistema SHALL enviar las
herramientas en un orden estable que no dependa de los permisos vigentes ni del
resultado de evaluar un permiso. El sistema SHALL construir el historial solo por
agregado dentro de un turno y SHALL NOT reordenar ni reescribir mensajes
anteriores. La compactación SHALL ejecutarse únicamente al final de un turno.

#### Scenario: Dos viajes del mismo turno comparten prefijo
- **WHEN** el turno hace dos llamadas al provider sin compactar
- **THEN** ambas peticiones llevan el mismo prompt de sistema y el mismo orden de herramientas

#### Scenario: El orden de herramientas no depende de permisos
- **WHEN** cambia el resultado de una evaluación de permisos entre dos viajes del mismo turno
- **THEN** el orden de las herramientas enviadas no cambia

#### Scenario: Cambiar de agente o modelo cambia el prefijo una vez
- **WHEN** el turno siguiente usa otro agente o modelo
- **THEN** el prefijo cambia una vez al empezar el turno y se mantiene estable durante ese turno

#### Scenario: Compactar invalida el prefijo una sola vez
- **WHEN** el turno termina y el historial se compacta
- **THEN** el turno siguiente arranca con un prefijo nuevo y no se recompacta en cada paso
