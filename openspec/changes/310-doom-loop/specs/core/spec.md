# Spec Delta

## REMOVED Requirements

### Requirement: La repetición idéntica consecutiva no se ejecuta
**Reason**: El bloqueo duro le quitaba la decisión a la persona y contradecía la
decisión de `doom_loop` como permiso. La repetición ya no es un error que corta la
ejecución.
**Migration**: La reemplaza «La repetición idéntica consecutiva pide aprobación».
El conteo, la comparación canónica de argumentos y el límite de pasos se conservan.

## ADDED Requirements

### Requirement: La repetición idéntica consecutiva pide aprobación
El sistema SHALL contar las llamadas consecutivas con el mismo nombre de
herramienta y los mismos argumentos, comparando los argumentos sin depender del
orden de sus claves. Al llegar a tres, SHALL NOT ejecutar la tercera sin una
aprobación obligatoria. La solicitud SHALL usar la acción de detectar repetición,
SHALL usar el nombre de la herramienta como recurso y SHALL informar el conteo.
Aprobar una vez SHALL ejecutar solo esa llamada. Si la tercera se aprobó, cada
llamada idéntica posterior SHALL volver a pedir aprobación. Denegar SHALL NOT
ejecutar la llamada, SHALL devolver el rechazo al modelo como texto y SHALL
mantener bloqueada esa firma hasta que cambie la herramienta o un argumento,
aunque se intercale otra llamada. El sistema SHALL reiniciar el conteo cuando
cambie la herramienta, cambie un argumento o haya otra llamada en el medio. Sin
cliente interactivo SHALL denegar. Sin portero SHALL mantener el bloqueo
defensivo. La aprobación SHALL NOT terminar el turno y el resultado SHALL
registrarse junto a la llamada.

#### Scenario: La tercera llamada idéntica pide aprobación
- **WHEN** el modelo repite la misma herramienta con los mismos argumentos por tercera vez consecutiva
- **THEN** el sistema no la ejecuta hasta que la persona apruebe o deniegue, y la solicitud usa la acción de detectar repetición con la herramienta como recurso

#### Scenario: Aprobar la tercera llamada la ejecuta
- **WHEN** la persona aprueba una vez la tercera llamada idéntica
- **THEN** el sistema ejecuta solo esa llamada y registra su resultado

#### Scenario: La cuarta llamada idéntica vuelve a pedir aprobación
- **WHEN** el modelo repite la misma llamada después de que la tercera fue aprobada
- **THEN** el sistema vuelve a pedir aprobación antes de ejecutarla

#### Scenario: Denegar la tercera llamada no la ejecuta
- **WHEN** la persona deniega la tercera llamada idéntica
- **THEN** el sistema no la ejecuta y devuelve el rechazo al modelo como texto

#### Scenario: Una firma denegada sigue bloqueada aunque se intercale otra llamada
- **WHEN** después de denegar una firma el modelo vuelve a pedir la misma herramienta con los mismos argumentos, aunque haya otra llamada en el medio
- **THEN** el sistema no ejecuta la llamada ni vuelve a pedir aprobación para esa firma

#### Scenario: Dos llamadas idénticas se ejecutan
- **WHEN** el modelo repite la misma herramienta con los mismos argumentos por segunda vez consecutiva
- **THEN** el sistema la ejecuta normalmente

#### Scenario: Cambiar un argumento reinicia el conteo
- **WHEN** el modelo llama a la misma herramienta con un argumento distinto
- **THEN** el sistema ejecuta la llamada y reinicia el conteo

#### Scenario: Otra llamada en el medio reinicia el conteo
- **WHEN** entre dos llamadas idénticas no denegadas hay una llamada a otra herramienta
- **THEN** el sistema reinicia el conteo y la llamada idéntica se ejecuta

#### Scenario: El turno continúa después de la denegación
- **WHEN** el sistema deniega una llamada repetida
- **THEN** el modelo recibe el rechazo y el turno sigue en curso

#### Scenario: La denegación queda en el historial junto a su llamada
- **WHEN** el turno termina después de denegar una repetición
- **THEN** el historial contiene el rechazo junto a la llamada que lo produjo

#### Scenario: Sin terminal se deniega la repetición
- **WHEN** la tercera llamada idéntica requiere aprobación y no hay cliente interactivo
- **THEN** el sistema no la ejecuta y devuelve el motivo como texto

#### Scenario: Sin portero no se ejecuta la repetición
- **WHEN** la tercera llamada idéntica ocurre sin un portero de permisos
- **THEN** el sistema no la ejecuta y devuelve el bloqueo como texto
