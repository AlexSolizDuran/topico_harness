# Spec Delta

## ADDED Requirements

### Requirement: La interfaz informa cuando la ejecución no está aislada
La interfaz SHALL mostrar un aviso visible cuando la ejecución no está aislada.
El aviso SHALL indicar el motivo y SHALL mantenerse visible durante el turno. La
interfaz SHALL NOT mostrar el aviso como un error fatal.

#### Scenario: Plataforma sin aislamiento
- **WHEN** la plataforma no ofrece aislamiento y se ejecuta un comando
- **THEN** la interfaz muestra el aviso correspondiente

#### Scenario: Aislamiento deshabilitado
- **WHEN** la configuración deshabilita el aislamiento
- **THEN** la interfaz muestra el aviso con ese motivo

#### Scenario: El aviso no es fatal
- **WHEN** la interfaz muestra el aviso de ejecución no aislada
- **THEN** el turno sigue en curso y la sesión no se cancela
