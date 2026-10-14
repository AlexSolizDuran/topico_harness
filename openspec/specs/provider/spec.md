# provider Specification

## Purpose
La frontera entre el harness y el servicio que hospeda el modelo. Define un
contrato único de interacción que el resto del sistema consume sin saber qué
proveedor está detrás, traduce los eventos de ese proveedor a eventos propios,
reintenta ante fallos transitorios y expone el conteo de tokens que el proveedor ya
devuelve en cada respuesta.

## Requirements

### Requirement: El sistema expone una interfaz de provider agnóstica del modelo concreto
El sistema SHALL definir un contrato único de interacción con el proveedor,
declarado en términos propios del harness y no del modelo concreto. El sistema
SHALL NOT exponer en ese contrato tipos, nombres ni campos propios de un proveedor.
El sistema SHALL permitir dar de alta un proveedor nuevo sin modificar el bucle ni
las capacidades que lo consumen.

#### Scenario: El resto del sistema no distingue el proveedor
- **WHEN** el sistema procesa una respuesta recibida a través del contrato común
- **THEN** puede interpretarla sin conocer qué proveedor la produjo

#### Scenario: Se agrega un proveedor nuevo
- **WHEN** se da de alta un proveedor distinto del configurado
- **THEN** el bucle y el resto de capacidades no cambian

---

### Requirement: Los eventos del provider se traducen a eventos internos
El sistema SHALL convertir los eventos que emite un provider en eventos internos
del harness antes de entregarlos al resto del sistema. El sistema SHALL NOT exponer
eventos del provider fuera de la capa que los traduce. Los eventos internos SHALL
ser de texto, de solicitud de herramienta y de fin de respuesta.

#### Scenario: El texto llega fragmentado
- **WHEN** el provider entrega el texto de una respuesta en fragmentos sucesivos
- **THEN** el consumidor recibe los fragmentos como texto continuo de la misma respuesta

#### Scenario: Una solicitud de herramienta se expone sin el formato de origen
- **WHEN** el provider entrega una solicitud de herramienta con su estructura propia
- **THEN** el sistema la expone como un evento interno de solicitud de herramienta, sin esa estructura

#### Scenario: Agregar un provider no obliga a cambiar el consumidor
- **WHEN** se cambia el provider configurado
- **THEN** el consumidor de eventos no se modifica

---

### Requirement: El sistema reintenta ante fallos transitorios con espera creciente
El sistema SHALL reintentar una petición que falle por límite de tasa o por error
del servidor, con una espera que aumente entre intentos sucesivos. El sistema SHALL
NOT reintentar una petición que falle por una causa que no sea transitoria. El
sistema SHALL acotar el número de reintentos y devolver el fallo cuando se agoten.

#### Scenario: Límite de tasa
- **WHEN** el provider responde que se superó el límite de peticiones
- **THEN** el sistema reintenta después de una espera

#### Scenario: Error del servidor
- **WHEN** el provider responde con un error de servidor
- **THEN** el sistema reintenta después de una espera

#### Scenario: La espera aumenta entre intentos
- **WHEN** el sistema reintenta la misma petición más de una vez
- **THEN** la espera entre intentos sucesivos es mayor que la anterior

#### Scenario: Un fallo que no es transitorio
- **WHEN** el provider rechaza la petición por un error de sus propios datos
- **THEN** el sistema no reintenta y devuelve el fallo de inmediato

---

### Requirement: La credencial se lee del entorno y nunca se expone
El sistema SHALL obtener la credencial del entorno al iniciar una petición. El
sistema SHALL NOT incluir la credencial en ningún evento que produzca. El sistema
SHALL NOT escribir la credencial en ningún registro, ni en el texto devuelto al
modelo tras un fallo.

#### Scenario: Un fallo de red no expone la credencial
- **WHEN** una petición falla por un error de conexión
- **THEN** el mensaje de error devuelto no contiene la credencial

#### Scenario: El registro de una petición no la contiene
- **WHEN** el sistema registra la petición que realizó
- **THEN** el registro no incluye la credencial ni los encabezados que la portan

#### Scenario: Falta la credencial
- **WHEN** el entorno no define la credencial del provider configurado
- **THEN** el sistema informa que falta antes de intentar la petición, en lugar de enviarla mal formada

---

### Requirement: El sistema expone el conteo de tokens que reporta el provider
El sistema SHALL exponer, junto al resto de los eventos internos, el conteo de
tokens que el provider reporta para cada respuesta. El sistema SHALL exponer ese
dato con la misma forma sea cual sea el provider. El sistema SHALL NOT inventar un
valor para ese dato cuando el provider no lo reporte.

#### Scenario: El provider reporta el conteo
- **WHEN** el provider incluye el conteo de tokens en su respuesta
- **THEN** el sistema lo expone entre sus eventos internos

#### Scenario: El provider no reporta el conteo
- **WHEN** el provider termina una respuesta sin incluir el conteo
- **THEN** el sistema lo expone como ausente y no lo sustituye por un valor estimado

#### Scenario: Un dato con la misma forma para cualquier provider
- **WHEN** el sistema expone el conteo de tokens de la respuesta
- **THEN** lo hace con la misma forma con la que lo expondría de cualquier otro provider

---

### Requirement: El fin de la respuesta distingue entre terminado e interrumpido
El sistema SHALL distinguir en el evento de fin de respuesta si el provider la
completó por sí mismo o si se interrumpió antes. El sistema SHALL reportar el
motivo de la interrupción cuando exista. El sistema SHALL NOT presentar una
respuesta interrumpida como una respuesta completa.

#### Scenario: El provider completa la respuesta
- **WHEN** el provider termina la respuesta por sí mismo
- **THEN** el evento de fin informa que la respuesta está completa

#### Scenario: La respuesta se interrumpe por un límite
- **WHEN** la respuesta se corta porque el turno alcanzó su límite
- **THEN** el evento de fin informa que fue interrumpida y señala el motivo

#### Scenario: Una interrupción no se presenta como una respuesta completa
- **WHEN** una respuesta terminó interrumpida
- **THEN** el sistema no la reporta como completa ni la da por cerrada