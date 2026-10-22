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

### Requirement: La interfaz muestra el prompt del sistema de forma persistente
La interfaz SHALL mantener visible el prompt del sistema durante toda la sesión. La
interfaz SHALL NOT permitir modificarlo. La interfaz SHALL mantenerlo visible aunque
el historial se recorte o se resuma.

#### Scenario: Visible durante toda la sesión
- **WHEN** la sesión corre y el historial crece
- **THEN** el prompt del sistema permanece visible

#### Scenario: Sigue visible tras compactar
- **WHEN** el historial del turno se recorta o se resume
- **THEN** el prompt del sistema sigue visible

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
El sistema SHALL mostrar el modelo activo, el directorio de trabajo y si hay un
turno en curso. El sistema SHALL actualizar ese estado cuando cambie el modelo o
cuando empiece o termine un turno. El sistema SHALL NOT presentar el turno como
inactivo mientras siga en curso.

#### Scenario: Sesión lista
- **WHEN** no hay un turno en curso
- **THEN** la interfaz muestra el modelo, el directorio y que está lista

#### Scenario: Sesión trabajando
- **WHEN** hay un turno en curso
- **THEN** la interfaz muestra que está trabajando y no la presenta como lista

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
