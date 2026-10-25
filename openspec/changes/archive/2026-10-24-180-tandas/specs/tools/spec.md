# Spec Delta

## ADDED Requirements

### Requirement: Cada herramienta declara si admite ejecución en paralelo
Cada herramienta SHALL declarar si es segura para ejecutarse junto a otras. Una
herramienta que no declare nada SHALL tratarse como no segura y ejecutarse sola.
Leer, buscar archivos y buscar texto SHALL declararse seguras; escribir, editar,
ejecutar y delegar SHALL declararse no seguras.

#### Scenario: Una herramienta segura se agrupa con las consecutivas
- **WHEN** el modelo pide varias llamadas consecutivas de herramientas seguras
- **THEN** el sistema las agrupa en una misma tanda

#### Scenario: Una herramienta sin declaración se ejecuta sola
- **WHEN** una herramienta no declara si admite paralelo
- **THEN** el sistema la trata como no segura y la ejecuta sola
