# Spec Delta

## MODIFIED Requirements

### Requirement: La herramienta de ejecución se resuelve contra el catálogo de cada plataforma
El sistema SHALL ejecutar un comando solo si ese comando pertenece al catálogo de
la plataforma activa. El sistema SHALL usar el intérprete propio de la plataforma
activa; en Windows SHALL usar PowerShell. El sistema SHALL exponer la herramienta
de ejecución en Linux, macOS y Windows con el mismo nombre `shell`. El sistema SHALL
rechazar antes de ejecutar un comando que no pertenezca al catálogo, y SHALL
devolver al modelo un mensaje que indique que el comando no está disponible en esa
plataforma. El sistema SHALL evaluar la solicitud como una invocación simple y SHALL
rechazar una línea que componga varios comandos.

#### Scenario: El comando está en el catálogo
- **WHEN** el modelo solicita un comando presente en el catálogo de la plataforma activa
- **THEN** el sistema lo ejecuta con el intérprete de esa plataforma

#### Scenario: El comando no está en el catálogo
- **WHEN** el modelo solicita un comando ausente del catálogo de la plataforma activa
- **THEN** el sistema lo rechaza sin ejecutarlo y explica que no está disponible

#### Scenario: Un comando de otra plataforma
- **WHEN** el modelo solicita un comando que existe en otra plataforma pero no en la activa
- **THEN** el sistema lo rechaza en lugar de buscar un equivalente por su cuenta

#### Scenario: En Windows se usa PowerShell
- **WHEN** la plataforma activa es Windows
- **THEN** el sistema expone la herramienta y ejecuta el comando con PowerShell

#### Scenario: Un comando compuesto
- **WHEN** el modelo solicita una línea que encadena o compone varios comandos
- **THEN** el sistema la rechaza sin ejecutar y explica que solo admite una invocación simple

#### Scenario: El nombre es el mismo en todas las plataformas
- **WHEN** el modelo consulta las herramientas disponibles en Linux, macOS o Windows
- **THEN** la herramienta de ejecución aparece con el nombre `shell` en las tres

## ADDED Requirements

### Requirement: Cada herramienta declara su acción de permiso y su recurso
Cada herramienta SHALL declarar la acción de permiso que le corresponde y cómo se
obtiene el recurso sobre el que se evalúa. El sistema SHALL NOT habilitar una
herramienta que no declare ambas cosas. Escribir y editar SHALL compartir la acción
de editar; leer, buscar archivos y buscar texto SHALL tener cada uno la suya; la
ejecución SHALL usar la acción de ejecutar; la delegación SHALL usar la de delegar.

#### Scenario: El catálogo expone la acción y el recurso
- **WHEN** el sistema evalúa el permiso de una herramienta
- **THEN** obtiene la acción de la herramienta y el recurso de sus argumentos

#### Scenario: Una herramienta sin acción no se habilita
- **WHEN** se registra una herramienta que no declara su acción de permiso
- **THEN** el sistema no la habilita para el modelo
