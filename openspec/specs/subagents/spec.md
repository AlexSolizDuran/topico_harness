# subagents Specification

## Purpose
Delega una investigación acotada a un agente con contexto propio. El hijo lee,
busca y se equivoca sin ensuciar el historial del padre, y vuelve con una sola
respuesta de texto. La profundidad es uno y el hijo no modifica el proyecto: es un
investigador, no un agente con permisos que se auto-modificó.

## Requirements

### Requirement: El harness delega una investigación a un subagente
El sistema SHALL exponer una herramienta de delegación que reciba el nombre de un
subagente y un pedido, ejecute un turno hijo y devuelva la respuesta final del hijo
como resultado de la herramienta. El sistema SHALL ofrecer al modelo el nombre y la
descripción de cada subagente disponible. El sistema SHALL rechazar como texto un
nombre de subagente inexistente. El sistema SHALL NOT ofrecer el agente activo como
subagente de sí mismo.

#### Scenario: El modelo delega una búsqueda a un subagente
- **WHEN** el modelo invoca la delegación con un subagente válido y un pedido
- **THEN** el hijo ejecuta el pedido y el padre recibe su respuesta como resultado

#### Scenario: El modelo elige el subagente por su descripción
- **WHEN** hay varios subagentes disponibles
- **THEN** la herramienta ofrece el nombre y la descripción de cada uno

#### Scenario: Un subagente inexistente devuelve un error como texto
- **WHEN** el modelo nombra un subagente que no existe
- **THEN** el sistema no ejecuta nada y devuelve al modelo el error con los disponibles

#### Scenario: El agente activo no se ofrece como subagente de sí mismo
- **WHEN** el agente activo también es lanzable
- **THEN** la herramienta no lo ofrece como destino de la delegación

---

### Requirement: El subagente tiene contexto aislado
El turno hijo SHALL arrancar con una lista de mensajes propia que contenga solo el
pedido delegado y su prompt de sistema. El sistema SHALL NOT incorporar al hijo el
historial del padre. El sistema SHALL registrar en el padre una sola llamada y un
solo resultado. El sistema SHALL NOT registrar en el padre los mensajes intermedios
del hijo.

#### Scenario: El hijo no hereda el historial del padre
- **WHEN** el padre delega después de varios turnos
- **THEN** el hijo arranca solo con el pedido delegado y su prompt de sistema

#### Scenario: El padre no ve los pasos intermedios
- **WHEN** el hijo ejecuta varias herramientas
- **THEN** el historial del padre no contiene esas ejecuciones

#### Scenario: El contexto del padre crece solo con la respuesta
- **WHEN** el hijo termina
- **THEN** el padre incorpora el pedido delegado y la respuesta, nada más

---

### Requirement: El resultado del subagente es un texto único
El sistema SHALL entregar al padre solo el mensaje final del hijo. El sistema SHALL
NOT entregar eventos intermedios ni transmitir el texto del hijo mientras trabaja.
El sistema SHALL truncar el resultado con la misma regla que cualquier resultado de
herramienta.

#### Scenario: El padre recibe una respuesta, no un stream
- **WHEN** el hijo produce texto intermedio y termina
- **THEN** el padre recibe solo el mensaje final

#### Scenario: Un resultado largo se trunca
- **WHEN** la respuesta del hijo supera el máximo de un resultado de herramienta
- **THEN** el sistema la trunca e indica el truncado

---

### Requirement: Un subagente no puede lanzar subagentes
El turno hijo SHALL ejecutarse sin la herramienta de delegación. El sistema SHALL
rechazar como texto cualquier intento de delegación desde un turno hijo. La
profundidad de delegación SHALL ser uno.

#### Scenario: El subagente no tiene la herramienta de delegación
- **WHEN** el hijo recibe su conjunto de herramientas
- **THEN** ese conjunto no incluye la delegación

#### Scenario: Una delegación anidada se rechaza como texto
- **WHEN** el modelo del hijo pide delegar
- **THEN** el sistema no ejecuta otro turno y devuelve el rechazo como texto

---

### Requirement: Un subagente no modifica el proyecto
El turno hijo SHALL recibir solo las herramientas de su definición que no modifican
el proyecto ni ejecutan comandos. El sistema SHALL rechazar al arrancar una
definición de modo subagente que declare una herramienta de efecto. El sistema SHALL
rechazar como texto una llamada del hijo a una herramienta que no tiene.

#### Scenario: Un agente lanzado no recibe escritura ni ejecución
- **WHEN** un agente de modo ambos declara escribir y ejecutar y se lo lanza
- **THEN** el turno hijo recibe solo las herramientas de lectura

#### Scenario: Una definición de subagente con escritura falla al arrancar
- **WHEN** una definición de modo subagente declara escribir o ejecutar
- **THEN** el arranque falla con un mensaje que nombra la definición y la herramienta

#### Scenario: Una llamada del hijo a escribir se rechaza como texto
- **WHEN** el modelo del hijo pide escribir
- **THEN** el sistema no ejecuta y devuelve el rechazo como texto

---

### Requirement: La cancelación del padre alcanza al subagente
El sistema SHALL cancelar el turno hijo cuando se cancela el turno del padre. El
sistema SHALL NOT cancelar el turno del padre cuando el hijo falla, termina o se
cancela. Un hijo cancelado SHALL NOT entregar una respuesta parcial al padre.

#### Scenario: Cancelar el padre cancela al hijo
- **WHEN** la persona cancela el turno del padre mientras el hijo trabaja
- **THEN** el hijo se detiene y el padre no recibe su respuesta

#### Scenario: Cancelar al hijo no cancela al padre
- **WHEN** el turno hijo se cancela o falla
- **THEN** el turno del padre continúa

---

### Requirement: El subagente tiene presupuesto y límite de pasos propios
El turno hijo SHALL tener su propio presupuesto de contexto y su propio contador de
pasos. El sistema SHALL NOT descontar los pasos del hijo del límite del padre.
Cuando el hijo agota su presupuesto o su límite de pasos, el sistema SHALL devolver
el motivo al padre como texto.

#### Scenario: El límite de pasos del hijo no consume el del padre
- **WHEN** el hijo agota su límite de pasos
- **THEN** el padre conserva su contador y sigue su turno

#### Scenario: Un hijo que agota su límite devuelve el motivo
- **WHEN** el hijo llega a su límite de pasos o a su presupuesto
- **THEN** el padre recibe el motivo como texto

---

### Requirement: El subagente usa el modelo de su definición
Una definición de agente SHALL poder declarar un modelo. El turno hijo SHALL usar el
modelo declarado por el subagente y la ventana de contexto de ese modelo. El sistema
SHALL NOT dejar el modelo del padre cambiado al terminar el hijo.

#### Scenario: El hijo usa el modelo declarado
- **WHEN** el subagente declara un modelo
- **THEN** su turno envía las peticiones a ese modelo

#### Scenario: El modelo del padre no cambia después del hijo
- **WHEN** el hijo termina
- **THEN** el padre sigue usando el modelo que tenía antes de delegar

---

### Requirement: Sin configuración hay al menos un subagente de solo lectura
El sistema SHALL ofrecer, cuando no existe archivo de agentes, al menos un subagente
de solo lectura. Su prompt SHALL pedir que devuelva solo el resultado y no narre el
proceso. El sistema SHALL NOT requerir configuración para delegar en el primer
arranque.

#### Scenario: Sin archivo de agentes hay un subagente disponible
- **WHEN** la sesión arranca en un proyecto sin archivo de agentes
- **THEN** la delegación ofrece al menos un subagente

#### Scenario: El subagente por defecto pide solo el resultado
- **WHEN** se lanza el subagente por defecto
- **THEN** su prompt de sistema pide devolver solo el resultado
