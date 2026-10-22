# Spec Delta

## ADDED Requirements

### Requirement: La interfaz distingue una delegación a un subagente
La interfaz SHALL distinguir una delegación de una herramienta común. Mientras el
hijo trabaja SHALL mostrar el nombre del subagente y el pedido. Al terminar SHALL
mostrar el nombre del subagente y la respuesta como resumen. La interfaz SHALL NOT
presentar el texto del hijo como stream del padre. La interfaz SHALL mantener la
distinción en la salida línea a línea.

#### Scenario: La delegación se distingue de una herramienta común
- **WHEN** el agente delega en un subagente
- **THEN** la interfaz muestra una tarjeta con el nombre del subagente, distinta de la de una herramienta común

#### Scenario: La delegación terminada muestra el resumen
- **WHEN** el hijo responde
- **THEN** la tarjeta muestra el nombre del subagente y la respuesta

#### Scenario: El texto del hijo no aparece en el stream del padre
- **WHEN** el hijo genera texto intermedio
- **THEN** ese texto no se agrega al stream del padre

#### Scenario: La distinción se mantiene sin terminal
- **WHEN** la interfaz degrada a salida línea a línea
- **THEN** la delegación se marca con el subagente y no como una herramienta común
