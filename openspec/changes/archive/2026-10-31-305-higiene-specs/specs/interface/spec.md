# Spec Delta

## ADDED Requirements

### Requirement: La interfaz muestra el catálogo de skills
El sistema SHALL aceptar el comando `/skills` y SHALL mostrar un panel con el
catálogo de skills descubiertas. El panel SHALL mostrar, por cada skill, su
identificador, su nombre, su descripción y si el cuerpo ya fue cargado. El panel
SHALL mostrar las skills omitidas con su identificador y el motivo de la omisión.
Si no hay skills descubiertas, el panel SHALL mostrarse vacío e indicar dónde se
declaran. El panel SHALL NOT modificar el historial, el turno en curso ni el estado
de la sesión.

#### Scenario: Abrir el panel de skills
- **WHEN** la persona ejecuta `/skills`
- **THEN** la interfaz muestra el panel con el catálogo y el estado de carga de cada skill

#### Scenario: Panel sin skills
- **WHEN** la persona ejecuta `/skills` en un proyecto sin skills descubiertas
- **THEN** la interfaz muestra un panel vacío con la ubicación donde se declaran

#### Scenario: Skills omitidas visibles
- **WHEN** el descubrimiento omitió una skill por un frontmatter inválido
- **THEN** el panel muestra su identificador y el motivo de la omisión

#### Scenario: El panel no inicia un turno
- **WHEN** la persona ejecuta `/skills`
- **THEN** la sesión no inicia un turno y el estado del turno no cambia
