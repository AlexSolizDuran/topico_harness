# Spec Delta

## REMOVED Requirements

### Requirement: La herramienta de ejecución se resuelve contra el catálogo de la plataforma
**Reason**: El requisito prohibía exponer la herramienta en Windows. La allowlist
por comando y la regla de invocación simple permiten habilitarla sin prometer una
garantía que la lista negra no sostiene.
**Migration**: Lo reemplaza «La herramienta de ejecución se resuelve contra el
catálogo de cada plataforma». El catálogo Unix y su lista negra no cambian; se
agrega el catálogo de Windows y el rechazo de comandos compuestos.

## ADDED Requirements

### Requirement: La herramienta de ejecución se resuelve contra el catálogo de cada plataforma
El sistema SHALL ejecutar un comando solo si ese comando pertenece al catálogo de
la plataforma activa. El sistema SHALL usar el intérprete propio de la plataforma
activa; en Windows SHALL usar PowerShell. El sistema SHALL exponer la herramienta
de ejecución en Linux, macOS y Windows. El sistema SHALL rechazar antes de ejecutar
un comando que no pertenezca al catálogo, y SHALL devolver al modelo un mensaje que
indique que el comando no está disponible en esa plataforma. El sistema SHALL
evaluar la solicitud como una invocación simple y SHALL rechazar una línea que
componga varios comandos.

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
