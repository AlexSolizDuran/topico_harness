# Spec Delta

## ADDED Requirements

### Requirement: El presupuesto de un subagente es independiente del del padre
El turno hijo SHALL tener su propio presupuesto, calculado sobre la ventana de
contexto del modelo que usa. El sistema SHALL NOT contar el historial del hijo en el
presupuesto del padre. El sistema SHALL contar el resultado del hijo como el
resultado de una herramienta.

#### Scenario: El historial del hijo no consume el presupuesto del padre
- **WHEN** el hijo acumula un historial largo durante su investigación
- **THEN** el presupuesto del padre no cambia por ese historial

#### Scenario: El resultado del hijo se cuenta como un resultado de herramienta
- **WHEN** el hijo devuelve su respuesta
- **THEN** el presupuesto del padre la cuenta como un resultado de herramienta
