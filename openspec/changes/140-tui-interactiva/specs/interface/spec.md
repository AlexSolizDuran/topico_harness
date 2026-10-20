# Spec Delta

## ADDED Requirements

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
