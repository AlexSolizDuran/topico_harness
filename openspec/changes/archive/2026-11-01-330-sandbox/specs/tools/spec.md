# Spec Delta

## ADDED Requirements

### Requirement: El resultado de la herramienta de ejecución informa el aislamiento
El resultado de la herramienta de ejecución SHALL indicar si la ejecución corrió
aislada. Si no corrió aislada, SHALL incluir el motivo. El modelo SHALL recibir esa
información como parte del resultado y SHALL NOT recibir una ejecución no aislada
presentada como aislada.

#### Scenario: Ejecución aislada
- **WHEN** la ejecución corrió dentro del aislamiento
- **THEN** el resultado indica que estuvo aislada

#### Scenario: Ejecución no aislada con motivo
- **WHEN** la ejecución corrió sin aislamiento
- **THEN** el resultado incluye el motivo

#### Scenario: No se presenta como aislada
- **WHEN** el aislamiento no estuvo activo
- **THEN** el resultado no afirma que la ejecución estuvo aislada
