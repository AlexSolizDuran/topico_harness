# Spec Delta

## ADDED Requirements

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
