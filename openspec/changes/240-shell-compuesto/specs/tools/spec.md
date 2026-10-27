# Spec Delta

## MODIFIED Requirements

### Requirement: La herramienta de ejecución se resuelve contra el catálogo de cada plataforma
El sistema SHALL ejecutar un comando solo si ese comando pertenece al catálogo de
la plataforma activa. El sistema SHALL usar el intérprete propio de la plataforma
activa; en Windows SHALL usar PowerShell. El sistema SHALL exponer la herramienta
de ejecución en Linux, macOS y Windows con el mismo nombre `shell`. El sistema SHALL
rechazar antes de ejecutar un comando que no pertenezca al catálogo, y SHALL
devolver al modelo un mensaje que indique que el comando no está disponible en esa
plataforma. En Unix el sistema SHALL admitir líneas que compongan varios comandos
con `;`, `&&`, `||` y `|`. El sistema SHALL validar cada segmento contra el catálogo
y la lista negra, y si un segmento no pasa la validación SHALL rechazar la línea
completa sin ejecutar ningún segmento. El sistema SHALL evaluar una línea compuesta
con la acción `shell_compuesto`; una invocación simple SHALL evaluarse con la acción
`shell`. El sistema SHALL tratar como compuesta una invocación a un intérprete que
ejecute código con una bandera (`-c`, `-e`, `--eval`). En Windows el sistema SHALL
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
- **WHEN** el modelo solicita una línea que encadena varios comandos en una plataforma que no los admite
- **THEN** el sistema la rechaza sin ejecutar y explica que solo admite una invocación simple

#### Scenario: Un comando compuesto en Unix
- **WHEN** el modelo solicita en Unix una línea cuyos segmentos pertenecen al catálogo y no están bloqueados
- **THEN** el sistema valida la línea completa y la ejecuta con la acción `shell_compuesto`

#### Scenario: Un segmento prohibido bloquea la línea completa
- **WHEN** la línea compuesta incluye un segmento de la lista negra o fuera del catálogo
- **THEN** el sistema rechaza la línea completa sin ejecutar ningún segmento y devuelve el motivo al modelo

#### Scenario: Un intérprete con -c cuenta como compuesto
- **WHEN** el modelo solicita `bash -c`, `sh -c`, `node -e` o `python3 -c` con código entre comillas
- **THEN** el sistema lo evalúa con la acción `shell_compuesto` y no como una invocación simple

#### Scenario: La sustitución de comandos se rechaza
- **WHEN** la línea incluye `$()` o backticks fuera de comillas
- **THEN** el sistema la rechaza sin ejecutar

#### Scenario: El nombre es el mismo en todas las plataformas
- **WHEN** el modelo consulta las herramientas disponibles en Linux, macOS o Windows
- **THEN** la herramienta de ejecución aparece con el nombre `shell` en las tres

## ADDED Requirements

### Requirement: La herramienta de ejecución acepta un directorio de trabajo
La herramienta de ejecución SHALL aceptar un parámetro opcional `directorio`. Si
se omite, SHALL ejecutar en la raíz del proyecto. Si se indica, el sistema SHALL
resolverlo con la misma regla de rutas que las herramientas de archivo: SHALL
rechazar un directorio que quede fuera del proyecto y SHALL rechazar uno que no
exista o que no sea un directorio. El rechazo SHALL volver al modelo como texto y
SHALL NOT ejecutar el comando.

#### Scenario: Un directorio dentro del proyecto
- **WHEN** el modelo indica un subdirectorio existente del proyecto
- **THEN** el comando se ejecuta con ese directorio como cwd

#### Scenario: Un directorio fuera del proyecto
- **WHEN** el modelo indica un directorio que queda fuera del proyecto
- **THEN** el sistema rechaza la solicitud sin ejecutar el comando

#### Scenario: Un directorio inexistente
- **WHEN** el modelo indica un directorio que no existe en el proyecto
- **THEN** el sistema rechaza la solicitud sin ejecutar el comando
