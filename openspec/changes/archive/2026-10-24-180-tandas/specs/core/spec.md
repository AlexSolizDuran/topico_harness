# Spec Delta

## MODIFIED Requirements

### Requirement: Las herramientas se despachan contra un registro de datos
El sistema SHALL resolver cada herramienta solicitada por nombre contra un registro
que asocia un nombre con su esquema y su forma de ejecutarla. El sistema SHALL NOT
resolver herramientas mediante una condicional sobre su nombre. El sistema SHALL
permitir registrar una herramienta nueva sin modificar el bucle. Antes de ejecutar
una herramienta, el sistema SHALL consultar su permiso. Con efecto de permitir SHALL
ejecutarla; con efecto de denegar SHALL NOT ejecutarla y SHALL devolver el rechazo
al modelo como texto; con efecto de consultar SHALL esperar la decisión sin
ejecutarla. El sistema SHALL agrupar las llamadas consecutivas cuyas herramientas
admiten ejecución en paralelo y SHALL ejecutarlas en una misma tanda. Una llamada
cuya herramienta no admite paralelo SHALL cortar la tanda y ejecutarse sola. Si
alguna llamada de la tanda requiere aprobación, el sistema SHALL esperar la decisión
antes de ejecutar la tanda.

#### Scenario: Una herramienta nueva se agrega sin tocar el bucle
- **WHEN** se da de alta una herramienta nueva en el registro
- **THEN** el modelo puede solicitarla sin que el bucle cambie

#### Scenario: El nombre se resuelve contra el registro
- **WHEN** el modelo solicita una herramienta cuyo nombre está en el registro
- **THEN** el sistema ejecuta la función asociada a ese nombre

#### Scenario: Una herramienta permitida se ejecuta
- **WHEN** la regla que gana permite la acción de la herramienta
- **THEN** el sistema la ejecuta sin consultar

#### Scenario: Una herramienta denegada no se ejecuta
- **WHEN** la regla que gana deniega la acción de la herramienta
- **THEN** el sistema no la ejecuta y devuelve el rechazo al modelo

#### Scenario: Una herramienta en espera no se ejecuta hasta que se decida
- **WHEN** la regla que gana consulta la acción de la herramienta
- **THEN** el sistema espera la decisión y no la ejecuta mientras espera

#### Scenario: Las lecturas consecutivas se ejecutan juntas
- **WHEN** el modelo pide varias lecturas consecutivas
- **THEN** el sistema las ejecuta en una misma tanda en lugar de una por una

#### Scenario: Una escritura corta la tanda
- **WHEN** el modelo pide dos lecturas, una escritura y otra lectura
- **THEN** el sistema ejecuta las dos primeras juntas, después la escritura y después la lectura final

#### Scenario: Una aprobación pendiente frena la tanda
- **WHEN** una llamada de la tanda requiere aprobación
- **THEN** el sistema espera la decisión antes de ejecutar cualquier llamada de la tanda

## ADDED Requirements

### Requirement: La tanda conserva el orden y entrega un resultado por llamada
El sistema SHALL registrar los resultados en el orden de las llamadas, no en el
orden en que terminan. El sistema SHALL entregar exactamente un resultado por
llamada, incluso si la llamada falla o se cancela. El sistema SHALL NOT cancelar las
demás llamadas de la tanda cuando una falla. La cancelación del turno SHALL abortar
las llamadas en vuelo de la tanda.

#### Scenario: El resultado se guarda en el orden de la llamada
- **WHEN** una llamada posterior termina antes que una anterior
- **THEN** el historial conserva el orden en que el modelo pidió las llamadas

#### Scenario: Un fallo no cancela el resto de la tanda
- **WHEN** una llamada de la tanda falla
- **THEN** las demás terminan y el modelo recibe el error de la que falló como texto

#### Scenario: Cancelar la tanda deja un resultado por llamada
- **WHEN** se cancela el turno mientras una tanda está en vuelo
- **THEN** cada llamada termina con un resultado y el historial no queda con llamadas sin respuesta
