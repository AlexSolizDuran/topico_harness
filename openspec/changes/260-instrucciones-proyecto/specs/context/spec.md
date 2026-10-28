# Spec Delta

## MODIFIED Requirements

### Requirement: El presupuesto se alimenta del conteo del provider con respaldo estimado
El sistema SHALL alimentar el presupuesto con el conteo de tokens que el provider
reporta. Cuando el provider no reporte ese conteo, el sistema SHALL estimarlo a
partir del largo del texto y SHALL incluir el prompt de sistema en esa
estimación. El sistema SHALL estimar con margen deliberadamente conservador y
SHALL NOT usar la estimación como si fuera exacta.

#### Scenario: El provider reporta el conteo
- **WHEN** el provider reporta el conteo de tokens de la respuesta
- **THEN** el sistema lo usa para actualizar el presupuesto

#### Scenario: El provider no lo reporta
- **WHEN** una respuesta llega sin conteo de tokens
- **THEN** el sistema estima a partir del largo del texto y lo usa como respaldo

#### Scenario: La estimación no se presenta como exacta
- **WHEN** el presupuesto se actualizó con un valor estimado
- **THEN** el sistema lo trata como aproximado y no como el conteo del provider

#### Scenario: La estimación incluye el prompt de sistema
- **WHEN** el sistema estima el uso y el prompt de sistema tiene contenido
- **THEN** la estimación incluye el costo de ese prompt
