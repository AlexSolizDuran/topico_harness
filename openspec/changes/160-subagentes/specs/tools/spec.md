# Spec Delta

## ADDED Requirements

### Requirement: La herramienta de delegación declara su esquema
La herramienta de delegación SHALL declarar un esquema con el nombre del subagente y
el pedido, ambos obligatorios. El sistema SHALL limitar el nombre del subagente a los
que existen. El sistema SHALL devolver como texto un argumento que no cumpla el
esquema.

#### Scenario: La herramienta de delegación declara agente y pedido
- **WHEN** el modelo consulta qué acepta la delegación
- **THEN** el esquema expone el subagente y el pedido como obligatorios

#### Scenario: Un argumento inválido vuelve como texto
- **WHEN** el modelo envía un argumento que no cumple el esquema
- **THEN** el sistema no ejecuta la delegación y devuelve el error como texto
