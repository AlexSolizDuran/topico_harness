# interface Specification

## Purpose
Lo que ve la persona. Muestra el texto del modelo a medida que llega y cada
herramienta ejecutada, permite escribir el siguiente pedido y cancelar el turno en
curso. Cuando no hay terminal interactiva, degrada a salida línea a línea sin
perder contenido. No contiene lógica de negocio: muestra lo que el núcleo le da y
nada más.

## Requirements

### Requirement: La interfaz muestra el texto del modelo a medida que llega
La interfaz SHALL mostrar el texto del modelo mientras se produce, sin esperar a que
la respuesta termine. La interfaz SHALL conservar el texto ya mostrado cuando la
respuesta se completa. La interfaz SHALL NOT volver a redibujar un mensaje una vez
que quedó completo.

#### Scenario: El texto se ve mientras llega
- **WHEN** el modelo está produciendo una respuesta
- **THEN** la interfaz muestra el texto a medida que se recibe

#### Scenario: El mensaje completo queda fijo
- **WHEN** una respuesta termina
- **THEN** el texto queda mostrado completo y ya no se redibuja

#### Scenario: Varias respuestas en la misma sesión
- **WHEN** la sesión acumula varios turnos
- **THEN** la interfaz conserva el texto de todos ellos en orden

---

### Requirement: La interfaz muestra cada herramienta ejecutada y su resultado
La interfaz SHALL mostrar el nombre de cada herramienta que el modelo solicita y el
resultado que produjo. La interfaz SHALL distinguir un error de una herramienta de
un resultado exitoso. La interfaz SHALL indicar cuando el resultado fue truncado.

#### Scenario: Herramienta ejecutada
- **WHEN** el modelo solicita una herramienta
- **THEN** la interfaz muestra su nombre y el resultado que devolvió

#### Scenario: La herramienta falló
- **WHEN** una herramienta devuelve un error
- **THEN** la interfaz lo muestra como error y el turno continúa visible

#### Scenario: Resultado truncado
- **WHEN** el contenido de una herramienta fue truncado
- **THEN** la interfaz lo indica

---

### Requirement: La interfaz permite escribir el siguiente pedido
La interfaz SHALL permitir escribir un mensaje cuando no hay un turno en curso. La
interfaz SHALL enviar el mensaje escrito al iniciar el siguiente turno. La interfaz
SHALL NOT descartar el texto escrito por el usuario al enviarlo.

#### Scenario: Escribir con el turno terminado
- **WHEN** no hay un turno en curso
- **THEN** la interfaz permite escribir un mensaje

#### Scenario: El mensaje inicia el turno siguiente
- **WHEN** el usuario envía lo que escribió
- **THEN** el turno comienza con ese mensaje

#### Scenario: No se escribe durante un turno
- **WHEN** hay un turno en curso
- **THEN** la interfaz no acepta un nuevo pedido hasta que el turno termine

---

### Requirement: La interfaz no muestra el prompt del sistema en la conversación
La interfaz interactiva SHALL NOT mostrar el prompt del sistema en el área de
conversación. La interfaz SHALL NOT permitir modificarlo. El prompt SHALL seguir
enviándose al modelo en cada turno aunque no se muestre.

#### Scenario: El prompt no ocupa espacio en la conversación
- **WHEN** la sesión corre y el historial crece
- **THEN** el área de conversación no muestra el prompt del sistema

#### Scenario: El prompt se sigue enviando al modelo
- **WHEN** el turno consulta al provider
- **THEN** el prompt del sistema se envía aunque no se muestre

---

### Requirement: La interfaz permite cancelar el turno en curso
La interfaz SHALL permitir cancelar el turno en curso desde la propia interfaz. La
interfaz SHALL reflejar que el turno quedó cancelado. La interfaz SHALL NOT seguir
presentando el turno como activo después de cancelarlo.

#### Scenario: Se cancela desde la interfaz
- **WHEN** hay un turno en curso
- **THEN** la interfaz permite cancelarlo

#### Scenario: El turno cancelado se refleja
- **WHEN** un turno termina por cancelación
- **THEN** la interfaz lo muestra como cancelado y habilita escribir de nuevo

---

### Requirement: Sin terminal interactiva la interfaz degrada a salida línea a línea
Cuando no haya terminal interactiva, la interfaz SHALL mostrar la salida como texto
corriente, una línea a la vez, sin secuencias de control. La interfaz SHALL NOT
perder contenido al degradarse. Cuando sí haya terminal interactiva, la interfaz
SHALL usar el modo interactivo completo.

#### Scenario: Ejecución sin terminal
- **WHEN** el proceso se ejecuta sin una terminal interactiva
- **THEN** la salida se muestra línea a línea y se puede redirigir a un archivo

#### Scenario: No se pierde contenido
- **WHEN** la interfaz degrada a salida línea a línea
- **THEN** la información mostrada es la misma que en modo interactivo

#### Scenario: Con terminal interactiva
- **WHEN** el proceso se ejecuta dentro de una terminal interactiva
- **THEN** la interfaz usa el modo interactivo completo

---

### Requirement: La interfaz no contiene lógica de negocio
La interfaz SHALL limitarse a presentar lo que el núcleo expone y a entregar lo que
la persona escribe. La interfaz SHALL NOT decidir el orden de las operaciones, ni
modificar el historial, ni interpretar el contenido de una respuesta. La interfaz
SHALL NOT completar una operación que el núcleo no haya indicado.

#### Scenario: La interfaz no decide
- **WHEN** el núcleo no emite un evento
- **THEN** la interfaz no inventa una acción a partir de lo que ya viene leyendo

#### Scenario: Cambiar de interfaz no cambia el comportamiento
- **WHEN** se reemplaza la implementación de la interfaz
- **THEN** los turnos se comportan igual y el núcleo no cambia

### Requirement: El harness se inicia desde la terminal sobre el proyecto actual
El sistema SHALL iniciarse como un proceso de terminal desde el directorio del
proyecto. El sistema SHALL tomar ese directorio como raíz para resolver rutas. El
sistema SHALL aceptar un pedido inicial como argumentos de la invocación.

#### Scenario: Arranque en el directorio del proyecto
- **WHEN** la persona ejecuta el harness desde un directorio
- **THEN** el sistema opera sobre ese directorio y sus archivos

#### Scenario: Pedido inicial por argumentos
- **WHEN** la invocación incluye texto después del nombre del comando
- **THEN** el sistema inicia un turno con ese texto como primer pedido

#### Scenario: Sin pedido inicial en una terminal interactiva
- **WHEN** la invocación no incluye texto
- **THEN** el sistema queda a la espera de que la persona escriba

### Requirement: La interfaz muestra el estado de la sesión
El sistema SHALL mostrar el modelo activo, el agente activo, el directorio de
trabajo y si hay un turno en curso. El sistema SHALL actualizar ese estado cuando
cambie el modelo, cuando cambie el agente o cuando empiece o termine un turno. El
sistema SHALL mostrar cuando el turno espera una aprobación. El sistema SHALL NOT
presentar el turno como inactivo mientras siga en curso.

#### Scenario: Sesión lista
- **WHEN** no hay un turno en curso
- **THEN** la interfaz muestra el modelo, el directorio y que está lista

#### Scenario: Sesión trabajando
- **WHEN** hay un turno en curso
- **THEN** la interfaz muestra que está trabajando y no la presenta como lista

#### Scenario: La barra muestra el agente activo
- **WHEN** la sesión tiene un agente activo
- **THEN** la barra de estado muestra su nombre junto al modelo

#### Scenario: La barra muestra la espera de aprobación
- **WHEN** el turno espera una aprobación
- **THEN** la barra de estado muestra que está esperando una decisión

### Requirement: La interfaz permite ejecutar comandos desde una lista
El sistema SHALL ofrecer una lista de comandos disponibles y SHALL permitir
elegir uno con el teclado. El sistema SHALL delegar la ejecución en la sesión. El
sistema SHALL NOT ejecutar un comando que la sesión no reconozca.

#### Scenario: Abrir la lista
- **WHEN** la persona escribe el carácter de comando en la entrada
- **THEN** la interfaz muestra los comandos disponibles con una descripción

#### Scenario: Elegir un comando
- **WHEN** la persona selecciona un comando de la lista
- **THEN** la interfaz lo ejecuta y vuelve a la entrada

#### Scenario: Elegir un modelo
- **WHEN** la persona elige un modelo desde la lista de modelos
- **THEN** la sesión cambia el modelo activo y conserva el historial

#### Scenario: Comando desconocido
- **WHEN** la persona envía un comando que la sesión no reconoce
- **THEN** la interfaz muestra el error y no inicia un turno

### Requirement: La interfaz permite escribir pedidos de varias líneas
El sistema SHALL permitir insertar saltos de línea en el pedido sin enviarlo. El
sistema SHALL enviar el pedido solo cuando la persona lo indique explícitamente.
El sistema SHALL NOT descartar el texto al insertar un salto de línea.

#### Scenario: Insertar un salto de línea
- **WHEN** la persona usa la combinación de nueva línea
- **THEN** el pedido conserva el texto y agrega un salto de línea

#### Scenario: Enviar un pedido de varias líneas
- **WHEN** la persona envía el pedido
- **THEN** el turno recibe el texto completo, con sus saltos de línea

### Requirement: La interfaz muestra una herramienta mientras se ejecuta
El sistema SHALL mostrar el nombre y los argumentos de una herramienta desde que
empieza a ejecutarse. El sistema SHALL reemplazar ese estado por el resultado
cuando termine. El sistema SHALL distinguir un error y un resultado truncado.

#### Scenario: Herramienta en curso
- **WHEN** una herramienta empieza a ejecutarse
- **THEN** la interfaz muestra su nombre y argumentos mientras sigue en curso

#### Scenario: Herramienta terminada
- **WHEN** una herramienta termina
- **THEN** la interfaz muestra el resultado y deja de presentarla como en curso

### Requirement: La interfaz muestra el uso del contexto
El sistema SHALL mostrar la ventana total del modelo, el límite del presupuesto,
el uso actual y el margen disponible. El sistema SHALL indicar si el uso actual
es exacto o estimado. El sistema SHALL actualizar esa información después de cada
turno, después de una compactación y después de cambiar de modelo.

#### Scenario: Uso actual visible
- **WHEN** la sesión está inactiva
- **THEN** la interfaz muestra el uso actual, el presupuesto y la ventana total

#### Scenario: Conteo estimado
- **WHEN** el provider no reportó el conteo de tokens
- **THEN** la interfaz marca el uso como estimado

#### Scenario: Después de compactar
- **WHEN** el historial se compacta
- **THEN** la interfaz muestra el uso actualizado y el antes/después

#### Scenario: Cambio de modelo
- **WHEN** se cambia a un modelo con otra ventana de contexto
- **THEN** la interfaz actualiza la ventana total y el presupuesto

### Requirement: La interfaz permite cambiar el agente activo
El sistema SHALL permitir elegir el agente activo entre los agentes primarios. El
sistema SHALL ofrecer un atajo para ciclar entre ellos y una lista para elegirlos.
El sistema SHALL NOT ofrecer como agente activo uno que no sea primario. El sistema
SHALL NOT cambiar de agente durante un turno en curso.

#### Scenario: Cambiar de agente con el atajo
- **WHEN** la persona usa el atajo de cambio de agente
- **THEN** el agente activo pasa al siguiente agente primario y la barra lo refleja

#### Scenario: Elegir un agente desde la lista
- **WHEN** la persona abre la lista de agentes y elige uno
- **THEN** la sesión lo activa y conserva el historial

#### Scenario: El agente activo se conserva entre turnos
- **WHEN** un turno termina
- **THEN** el agente activo sigue siendo el mismo que antes del turno

### Requirement: La interfaz distingue una delegación a un subagente
La interfaz SHALL distinguir una delegación de una herramienta común. Mientras el
hijo trabaja SHALL mostrar el nombre del subagente y el pedido. Al terminar SHALL
mostrar el nombre del subagente y la respuesta como resumen. La interfaz SHALL NOT
presentar el texto del hijo como stream del padre. La interfaz SHALL mantener la
distinción en la salida línea a línea.

#### Scenario: La delegación se distingue de una herramienta común
- **WHEN** el agente delega en un subagente
- **THEN** la interfaz muestra una tarjeta con el nombre del subagente, distinta de la de una herramienta común

#### Scenario: La delegación terminada muestra el resumen
- **WHEN** el hijo responde
- **THEN** la tarjeta muestra el nombre del subagente y la respuesta

#### Scenario: El texto del hijo no aparece en el stream del padre
- **WHEN** el hijo genera texto intermedio
- **THEN** ese texto no se agrega al stream del padre

#### Scenario: La distinción se mantiene sin terminal
- **WHEN** la interfaz degrada a salida línea a línea
- **THEN** la delegación se marca con el subagente y no como una herramienta común

### Requirement: La interfaz pide aprobación antes de ejecutar una herramienta
La interfaz SHALL mostrar la acción, el recurso y las opciones de aprobación cuando
una herramienta lo requiera. La interfaz SHALL ofrecer aprobar una vez, aprobar
siempre y denegar. La interfaz SHALL NOT ejecutar la herramienta ni asumir una
decisión. Sin terminal interactiva SHALL denegar la solicitud y explicar el motivo.

#### Scenario: Se pide aprobación con la acción y el recurso
- **WHEN** una herramienta requiere aprobación
- **THEN** la interfaz muestra la acción, el recurso y las tres opciones

#### Scenario: Aprobar una vez ejecuta solo esa solicitud
- **WHEN** la persona elige aprobar una vez
- **THEN** la herramienta se ejecuta y la siguiente solicitud vuelve a consultar

#### Scenario: Aprobar siempre deja de preguntar para ese patrón
- **WHEN** la persona elige aprobar siempre
- **THEN** la interfaz ejecuta la solicitud y no vuelve a preguntar por el patrón guardado

#### Scenario: Denegar devuelve el rechazo y no ejecuta
- **WHEN** la persona elige denegar
- **THEN** la herramienta no se ejecuta y el rechazo vuelve al modelo como texto

#### Scenario: Sin terminal interactiva no se aprueba nada
- **WHEN** una herramienta requiere aprobación y no hay terminal interactiva
- **THEN** la interfaz no la ejecuta y el motivo vuelve al modelo como texto

### Requirement: La interfaz muestra las herramientas de una tanda
La interfaz SHALL mostrar una tarjeta por cada llamada de la tanda en cuanto la
tanda empieza. La interfaz SHALL completar cada tarjeta cuando esa llamada termina,
en cualquier orden. La interfaz SHALL NOT reordenar las tarjetas según el orden de
finalización.

#### Scenario: Una tanda muestra todas sus tarjetas al empezar
- **WHEN** el turno ejecuta una tanda de varias llamadas
- **THEN** la interfaz muestra todas las tarjetas desde el inicio de la tanda

#### Scenario: Las tarjetas se completan a medida que terminan
- **WHEN** una llamada de la tanda termina antes que otra
- **THEN** su tarjeta se completa primero

#### Scenario: El orden de las tarjetas es el de las llamadas
- **WHEN** las llamadas de una tanda terminan en orden distinto al pedido
- **THEN** las tarjetas conservan el orden en que el modelo pidió las llamadas

### Requirement: La interfaz permite listar, cargar y crear sesiones
La interfaz SHALL ofrecer comandos para listar las sesiones guardadas, cargar una
por identificador y crear una sesión nueva. El listado SHALL mostrar identificador,
fecha, modelo y cantidad de mensajes. La interfaz SHALL NOT cambiar de sesión
mientras hay un turno en curso. Un identificador inválido SHALL mostrarse como aviso
y SHALL dejar la sesión activa sin cambios.

#### Scenario: El usuario lista las sesiones
- **WHEN** el usuario ejecuta el comando de listado
- **THEN** la interfaz muestra las sesiones con identificador, fecha, modelo y cantidad de mensajes

#### Scenario: El usuario carga una sesión
- **WHEN** el usuario ejecuta el comando de carga con un identificador válido
- **THEN** la interfaz muestra el historial restaurado de esa sesión

#### Scenario: El usuario crea una sesión nueva
- **WHEN** el usuario ejecuta el comando de sesión nueva
- **THEN** la interfaz queda sin historial y lista para un pedido nuevo

#### Scenario: No se cambia de sesión durante un turno
- **WHEN** el usuario pide cambiar de sesión mientras hay un turno en curso
- **THEN** la interfaz rechaza el cambio y el turno continúa

#### Scenario: Un identificador inválido no cambia la sesión
- **WHEN** el usuario pide cargar una sesión que no existe
- **THEN** la interfaz muestra el error y conserva la sesión activa

---

### Requirement: La interfaz muestra la sesión activa
La interfaz SHALL mostrar el identificador de la sesión activa cuando el guardado
está habilitado. Sin terminal interactiva, el modo línea a línea SHALL informar el
identificador al iniciar o reanudar.

#### Scenario: La barra de estado muestra la sesión
- **WHEN** hay una sesión activa guardada
- **THEN** la barra de estado muestra su identificador

#### Scenario: El modo línea a línea informa la sesión
- **WHEN** se inicia o reanuda una sesión sin terminal interactiva
- **THEN** la salida informa el identificador de la sesión activa

### Requirement: La interfaz muestra las tareas en background activas
La interfaz SHALL mostrar cuántas tareas en background siguen en curso. Cuando la
última termina, el indicador SHALL desaparecer o quedar en cero. La espera al cerrar
el turno SHALL ser visible como un aviso.

#### Scenario: La barra muestra tareas en curso
- **WHEN** hay una o más tareas en background en curso
- **THEN** la barra de estado muestra su cantidad

#### Scenario: La espera al cerrar el turno es visible
- **WHEN** el turno del padre termina y espera tareas en background
- **THEN** la interfaz muestra un aviso de espera

### Requirement: La interfaz permite crear una rama de la sesión activa
La interfaz SHALL aceptar `/rama <n>` para crear una sesión nueva desde el turno
`n` de la sesión activa y SHALL cambiarla a esa rama. Si `n` no es un entero mayor
o igual que cero, SHALL mostrar un error y conservar la sesión activa. Si la sesión
no tiene ese turno, SHALL mostrar el error de la sesión y conservar la activa.

#### Scenario: Crear una rama desde la interfaz
- **WHEN** el usuario ejecuta `/rama <n>` con un turno válido
- **THEN** la interfaz pasa a la sesión nueva y muestra un aviso

#### Scenario: Un número de turno inválido
- **WHEN** el usuario ejecuta `/rama` sin un número válido
- **THEN** la interfaz muestra un error y conserva la sesión activa

---

### Requirement: La interfaz permite buscar en las sesiones
La interfaz SHALL aceptar `/sesiones buscar <texto>` y SHALL mostrar las sesiones
con coincidencias, su cantidad y un fragmento. Si no hay coincidencias SHALL
mostrar un panel vacío. Sin texto SHALL mostrar el uso del comando.

#### Scenario: Buscar desde la interfaz
- **WHEN** el usuario ejecuta `/sesiones buscar <texto>` con coincidencias
- **THEN** la interfaz muestra las sesiones encontradas con su fragmento

#### Scenario: Búsqueda sin coincidencias
- **WHEN** el usuario busca un texto que no aparece en ninguna sesión
- **THEN** la interfaz muestra que no hay coincidencias
