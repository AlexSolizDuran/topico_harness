# Spec Delta

## ADDED Requirements

### Requirement: El modelo activo se puede cambiar entre turnos
El sistema SHALL permitir cambiar el provider o el modelo activo de una sesión sin
reiniciar el proceso. El sistema SHALL conservar el historial al cambiar de modelo.
El sistema SHALL NOT aceptar un cambio mientras hay un turno en curso. El sistema
SHALL NOT activar un provider o un modelo que no esté configurado, ni uno cuya
credencial falte. El sistema SHALL aplicar al turno siguiente las capacidades
declaradas por el modelo elegido.

#### Scenario: Cambio entre turnos
- **WHEN** la persona cambia el modelo activo después de que un turno terminó
- **THEN** el turno siguiente usa el modelo nuevo

#### Scenario: El historial se conserva
- **WHEN** se cambia de modelo en medio de una sesión
- **THEN** el historial previo se conserva y el turno siguiente continúa desde ahí

#### Scenario: Cambio durante un turno
- **WHEN** se pide cambiar de modelo mientras hay un turno en curso
- **THEN** el sistema rechaza el cambio y el turno en curso no se altera

#### Scenario: Modelo desconocido
- **WHEN** se pide un provider o un modelo que no está en la configuración
- **THEN** el sistema informa el error y mantiene el modelo activo anterior

#### Scenario: Falta la credencial del modelo nuevo
- **WHEN** el provider elegido no tiene su credencial en el entorno
- **THEN** el sistema no activa el cambio y mantiene el modelo anterior

#### Scenario: El modelo nuevo no soporta herramientas
- **WHEN** el modelo elegido declara que no soporta herramientas
- **THEN** el turno siguiente corre sin exponer herramientas
