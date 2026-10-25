# core Specification

## Purpose
El bucle que convierte un modelo que solo genera texto en un agente que hace cosas.
Itera entre el modelo y las herramientas hasta que el modelo termina, entrega los
errores de vuelta al modelo para que se corrija solo, se detiene por limite de pasos
y se cancela a mitad de tarea dejando el estado consistente. Es la pieza de la que
dependen las otras cuatro.

## Requirements

### Requirement: El bucle itera hasta que el modelo termina sin pedir más herramientas
El sistema SHALL mantener una conversación iterativa en la que cada respuesta del
modelo que solicita herramientas se ejecuta y su resultado se devuelve al modelo.
El sistema SHALL continuar iterando hasta que el modelo produzca una respuesta sin
solicitar herramientas. El sistema SHALL conservar el orden estricto de la
conversación: un mensaje del usuario, la respuesta del modelo, el resultado de
cada herramienta solicitada, y la siguiente respuesta del modelo.

#### Scenario: Una tarea de varios pasos se completa
- **WHEN** el usuario pide agregar una prueba para una función y el modelo lee, busca, edita y ejecuta la prueba
- **THEN** el sistema itera hasta que el modelo informa que la tarea terminó y la prueba pasa

#### Scenario: El modelo termina sin pedir herramientas
- **WHEN** el modelo produce una respuesta final sin solicitar herramientas
- **THEN** el sistema cierra el turno y no vuelve a invocarlo

#### Scenario: Varias herramientas en un mismo turno
- **WHEN** el modelo solicita tres herramientas antes de responder
- **THEN** el sistema ejecuta las tres y devuelve los tres resultados en esa misma respuesta

---

### Requirement: El historial es atómico y un resultado siempre sigue a su mensaje
El sistema SHALL construir el historial de la conversación como una secuencia en
la que cada resultado de herramienta sigue inmediatamente al mensaje del modelo que
la solicitó. El sistema SHALL NOT enviar al provider un historial que contenga un
resultado de herramienta sin su mensaje correspondiente. El sistema SHALL NOT
modificar ni eliminar mensajes del historial una vez enviados durante el turno.

#### Scenario: Un resultado sin su mensaje es rechazado
- **WHEN** se intenta enviar un historial con un resultado de herramienta sin el mensaje del modelo que la solicitó
- **THEN** el sistema rechaza la petición antes de enviarla al provider

#### Scenario: Los mensajes del usuario no se alteran
- **WHEN** el usuario escribe un mensaje durante el turno
- **THEN** el sistema lo conserva sin modificar en el historial

---

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

### Requirement: Los argumentos se validan contra el esquema antes de ejecutar
El sistema SHALL validar los argumentos de toda herramienta solicitada contra el
esquema declarado por esa herramienta antes de ejecutarla. El sistema SHALL
devolver al modelo un mensaje de error que describa qué se esperaba y qué se recibió
cuando la validación falle. El sistema SHALL NOT ejecutar una herramienta cuyos
argumentos no superen la validación.

#### Scenario: Faltan argumentos obligatorios
- **WHEN** el modelo solicita una herramienta sin uno de sus argumentos obligatorios
- **THEN** el sistema no la ejecuta y devuelve al modelo un mensaje que indique qué argumento falta

#### Scenario: Los argumentos llegan como texto
- **WHEN** el modelo entrega los argumentos como una cadena de texto en lugar de una estructura
- **THEN** el sistema interpreta la cadena antes de validarla contra el esquema

#### Scenario: El modelo inventa un campo
- **WHEN** el modelo envía un campo que el esquema no declara
- **THEN** el sistema lo descarta y valida el resto sin fallar

---

### Requirement: Un error de ejecución vuelve al modelo como texto
El sistema SHALL convertir todo error producido durante la ejecución de una
herramienta en un mensaje de texto devuelto al modelo como resultado. El sistema
SHALL NOT propagar el error como excepción hacia afuera del turno. El sistema SHALL
truncar el mensaje de error a un largo razonable y SHALL NOT incluir en él la
credencial del provider.

#### Scenario: Una prueba falla y el modelo se corrige
- **WHEN** el modelo ejecuta la suite de pruebas y una falla por un import mal escrito
- **THEN** el sistema devuelve el error como texto y el modelo lo lee y corrige en el siguiente paso sin intervención humana

#### Scenario: Una herramienta falla con una excepción inesperada
- **WHEN** una herramienta lanza una excepción no prevista
- **THEN** el sistema la convierte en texto y el turno continúa

#### Scenario: El mensaje de error no expone la credencial
- **WHEN** una herramienta falla con un error que contiene la credencial del provider
- **THEN** el sistema la omite del mensaje que vuelve al modelo

---

### Requirement: El límite de pasos interrumpe y devuelve el estado
El sistema SHALL limitar la cantidad de iteraciones de un turno a un máximo
configurable, cuyo valor por defecto es 25 pasos. Cuando el sistema alcance ese
máximo, SHALL interrumpir la iteración y SHALL devolver al modelo un mensaje que
describa el estado alcanzado antes de cortar. El sistema SHALL NOT exceder el límite
ni siquiera cuando el modelo siga solicitando herramientas.

#### Scenario: El modelo entra en un bucle y el turno se corta
- **WHEN** el modelo repite la misma herramienta y alcanza el límite de pasos
- **THEN** el sistema interrumpe el turno y devuelve un mensaje que describa qué se hizo y qué quedó pendiente

#### Scenario: Una tarea normal no se corta
- **WHEN** una tarea se completa en menos pasos que el límite
- **THEN** el sistema la deja terminar sin interrumpirla

#### Scenario: El valor por defecto es 25
- **WHEN** el sistema arranca sin configuración explícita
- **THEN** el límite de pasos del turno es 25

---

### Requirement: La cancelación interrumpe la petición en vuelo
El sistema SHALL permitir cancelar el turno en curso y SHALL usar esa señal para
interrumpir la petición que está esperando al provider. El sistema SHALL NOT
limitar la cancelación a detener la salida en pantalla. El sistema SHALL NOT seguir
consumiendo recursos del provider una vez cancelado.

#### Scenario: Se cancela esperando al modelo
- **WHEN** el usuario cancela mientras el sistema espera la respuesta del provider
- **THEN** el sistema interrumpe la petición y no la continúa en segundo plano

#### Scenario: El turno queda marcado como cancelado
- **WHEN** un turno termina por cancelación
- **THEN** el sistema lo registra como cancelado y distingue ese estado de uno terminado

---

### Requirement: Todo turno termina en uno de tres estados consistentes
El sistema SHALL clasificar el desenlace de todo turno como completado, cancelado o
fallido. El sistema SHALL registrar el motivo cuando el turno termine de forma
fallida. El sistema SHALL dejar el estado recuperable: un turno interrumpido SHALL
NOT dejar operaciones a medias que impidan iniciar el siguiente.

#### Scenario: Turno completado
- **WHEN** el modelo termina sin solicitar más herramientas y no hubo errores
- **THEN** el sistema registra el turno como completado

#### Scenario: Turno fallido
- **WHEN** el provider lanza un error que impide continuar
- **THEN** el sistema registra el turno como fallido junto con el motivo

#### Scenario: Se puede iniciar un turno nuevo después de cancelar
- **WHEN** un turno terminó cancelado y el usuario escribe un mensaje nuevo
- **THEN** el sistema acepta el turno nuevo y el estado anterior no interfiere

---

### Requirement: El núcleo no depende de la interfaz
El sistema SHALL mantener la lógica del turno, el historial, el despacho de
herramientas y la cancelación en un núcleo que no importa ningún componente de
interfaz. El sistema SHALL permitir ejecutar un turno completo sin ninguna interfaz
presente. El sistema SHALL NOT importar desde el núcleo ningún módulo de
presentación.

#### Scenario: Un turno corre sin interfaz
- **WHEN** el núcleo se ejecuta con entrada y salida sin componentes visuales
- **THEN** el turno se completa con el mismo resultado que con interfaz presente

#### Scenario: Cambiar de interfaz no toca el núcleo
- **WHEN** se reemplaza la implementación de la interfaz
- **THEN** el núcleo no cambia y los turnos se comportan igual

### Requirement: La espera de aprobación no rompe el turno
El sistema SHALL mantener el turno en curso mientras espera una aprobación. El
sistema SHALL cancelar la espera cuando se cancela el turno. El sistema SHALL NOT
agregar al historial un resultado sin su llamada. Un rechazo SHALL volver al modelo
como resultado y el turno SHALL continuar.

#### Scenario: Cancelar mientras se espera termina el turno cancelado
- **WHEN** la persona cancela el turno mientras espera una aprobación
- **THEN** el sistema cancela la espera y termina el turno como cancelado

#### Scenario: Un rechazo vuelve al modelo y el turno continúa
- **WHEN** la persona deniega una solicitud
- **THEN** el modelo recibe el rechazo como resultado y sigue su turno

#### Scenario: La espera no deja un resultado huérfano
- **WHEN** el turno termina después de una espera
- **THEN** el historial contiene cada resultado junto a su llamada

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

### Requirement: La repetición idéntica consecutiva no se ejecuta
El sistema SHALL contar las llamadas consecutivas con el mismo nombre de
herramienta y los mismos argumentos, comparando los argumentos sin depender del
orden de sus claves. Al llegar a tres, SHALL NOT ejecutar la tercera y SHALL
devolver al modelo un mensaje que indique la repetición y que el resultado anterior
no cambió. Toda llamada idéntica posterior SHALL NOT ejecutarse mientras el conteo
no se reinicie. El sistema SHALL reiniciar el conteo cuando cambie la herramienta,
cambie un argumento o haya otra llamada en el medio. El bloqueo SHALL NOT terminar
el turno y SHALL registrar su resultado junto a la llamada.

#### Scenario: La tercera llamada idéntica no se ejecuta
- **WHEN** el modelo repite la misma herramienta con los mismos argumentos por tercera vez consecutiva
- **THEN** el sistema no la ejecuta y le devuelve un mensaje que indica la repetición

#### Scenario: Dos llamadas idénticas se ejecutan
- **WHEN** el modelo repite la misma herramienta con los mismos argumentos por segunda vez consecutiva
- **THEN** el sistema la ejecuta normalmente

#### Scenario: Cambiar un argumento reinicia el conteo
- **WHEN** el modelo llama a la misma herramienta con un argumento distinto
- **THEN** el sistema ejecuta la llamada y reinicia el conteo

#### Scenario: Otra llamada en el medio reinicia el conteo
- **WHEN** entre dos llamadas idénticas hay una llamada a otra herramienta
- **THEN** el sistema reinicia el conteo y la llamada idéntica se ejecuta

#### Scenario: El turno continúa después del bloqueo
- **WHEN** el sistema bloquea una llamada repetida
- **THEN** el modelo recibe el mensaje y el turno sigue en curso

#### Scenario: El bloqueo queda en el historial junto a su llamada
- **WHEN** el turno termina después de un bloqueo por repetición
- **THEN** el historial contiene el mensaje de bloqueo junto a la llamada que lo produjo
