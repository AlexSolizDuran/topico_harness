# lsp Specification

## Purpose
La capacidad de lenguaje da al agente inteligencia de código por símbolos en vez
de solo coincidencias de texto. Esta capacidad declara los servidores, expone sus
operaciones, devuelve diagnósticos después de editar y se degrada sin romper el
turno.

## Requirements

### Requirement: El sistema declara servidores de lenguaje en la configuración
El sistema SHALL leer de la configuración los servidores de lenguaje, con el
lenguaje o la extensión que cubren, el comando de arranque y el directorio raíz.
Una entrada incompleta SHALL fallar el arranque con un mensaje que nombre la
entrada. Sin servidores configurados, la sesión SHALL arrancar igual.

#### Scenario: Configuración válida
- **WHEN** la configuración declara un servidor con lenguaje, comando y raíz
- **THEN** el sistema lo registra para ese lenguaje

#### Scenario: Entrada incompleta
- **WHEN** una entrada de servidor no declara lenguaje, comando o raíz
- **THEN** el arranque falla nombrando la entrada

#### Scenario: Sin servidores
- **WHEN** la configuración no declara servidores de lenguaje
- **THEN** la sesión arranca igual y la herramienta de lenguaje informa que no hay servidor

### Requirement: El sistema expone operaciones de código por símbolos
El sistema SHALL exponer una herramienta de lenguaje con las operaciones de
definición, referencias, símbolos de documento, símbolos de workspace, hover y
diagnósticos. Cada operación SHALL declarar sus argumentos y devolver texto. La
herramienta SHALL aceptar una ruta y una posición o un símbolo según la operación.
Un argumento inválido SHALL volver al modelo como texto.

#### Scenario: Definición
- **WHEN** el modelo pide la definición de un símbolo en una posición
- **THEN** la herramienta devuelve la ubicación de la definición

#### Scenario: Referencias
- **WHEN** el modelo pide las referencias de un símbolo
- **THEN** la herramienta devuelve las ubicaciones donde se usa

#### Scenario: Símbolos de documento
- **WHEN** el modelo pide los símbolos de un archivo
- **THEN** la herramienta devuelve los símbolos del archivo

#### Scenario: Símbolos de workspace
- **WHEN** el modelo pide los símbolos de un workspace
- **THEN** la herramienta devuelve los símbolos del proyecto

#### Scenario: Hover
- **WHEN** el modelo pide información de un símbolo
- **THEN** la herramienta devuelve su tipo y firma como texto

#### Scenario: Diagnósticos
- **WHEN** el modelo pide los diagnósticos de un archivo
- **THEN** la herramienta devuelve los errores y advertencias como texto

#### Scenario: Argumento inválido
- **WHEN** la operación recibe argumentos que no corresponden
- **THEN** el sistema devuelve un error como texto

### Requirement: Los diagnósticos vuelven al agente después de editar
Después de una edición, el sistema SHALL consultar los diagnósticos del archivo
afectado y SHALL devolverlos al modelo como texto. SHALL limitarse a los archivos
modificados y SHALL truncar el resultado con un marcador si supera el límite. Un
fallo del servidor SHALL NOT impedir que la edición se registre.

#### Scenario: Edición con errores
- **WHEN** una edición deja errores de tipos en el archivo
- **THEN** el resultado incluye los diagnósticos del archivo

#### Scenario: Edición sin errores
- **WHEN** una edición no deja diagnósticos
- **THEN** el resultado no incluye una lista de errores

#### Scenario: Solo archivos modificados
- **WHEN** una edición afecta un archivo
- **THEN** el sistema consulta solo los diagnósticos de ese archivo

#### Scenario: Resultado truncado
- **WHEN** los diagnósticos superan el límite
- **THEN** el sistema trunca el resultado y deja un marcador

#### Scenario: Fallo del servidor no revierte la edición
- **WHEN** el servidor de lenguaje falla al pedir diagnósticos
- **THEN** la edición queda registrada y el fallo se informa como texto

### Requirement: Sin servidor disponible la operación falla como texto
Si no hay un servidor de lenguaje para el archivo, el sistema SHALL devolver un
error como texto y SHALL NOT terminar el turno. SHALL NOT inventar resultados. El
modelo SHALL poder seguir usando las herramientas de búsqueda.

#### Scenario: Sin servidor para el lenguaje
- **WHEN** el modelo pide una operación para un archivo sin servidor
- **THEN** el sistema devuelve un error como texto

#### Scenario: Servidor que no arranca
- **WHEN** el servidor configurado no arranca
- **THEN** la operación devuelve el fallo como texto y el turno sigue

#### Scenario: El turno continúa
- **WHEN** una operación de lenguaje falla
- **THEN** el turno no se cancela

#### Scenario: El modelo puede volver a buscar
- **WHEN** no hay servidor de lenguaje
- **THEN** el modelo puede seguir usando las herramientas de búsqueda

### Requirement: La herramienta de lenguaje es de solo lectura y respeta permisos
La herramienta de lenguaje SHALL ser de solo lectura. SHALL evaluarse con una
acción de permiso propia y SHALL usar la operación y el archivo como recurso.
SHALL NOT modificar el proyecto. Un subagente MAY recibirla si su definición la
declara.

#### Scenario: La operación no modifica archivos
- **WHEN** el modelo ejecuta cualquier operación de lenguaje
- **THEN** ningún archivo del proyecto cambia

#### Scenario: Una regla permitir
- **WHEN** una regla permite leer símbolos para un archivo
- **THEN** la operación se ejecuta sin preguntar

#### Scenario: Una regla denegar
- **WHEN** una regla deniega leer símbolos para un archivo
- **THEN** la operación no se ejecuta y el rechazo vuelve como texto

#### Scenario: Subagente con la herramienta declarada
- **WHEN** un subagente declara la herramienta de lenguaje en su definición
- **THEN** su turno la recibe y puede usarla

### Requirement: El ciclo de vida del servidor se cierra con la sesión
El sistema SHALL arrancar el servidor de lenguaje cuando se usa por primera vez y
SHALL cerrarlo al terminar la sesión o el turno hijo. SHALL NOT dejar procesos
huérfanos. Un servidor que falla al arrancar SHALL devolver un error como texto,
sin bloquear la sesión.

#### Scenario: Arranque bajo demanda
- **WHEN** el modelo usa por primera vez una operación de lenguaje
- **THEN** el sistema arranca el servidor en ese momento

#### Scenario: Cierre al terminar
- **WHEN** la sesión o el turno hijo termina
- **THEN** el sistema cierra el servidor que arrancó

#### Scenario: Servidor caído no bloquea
- **WHEN** el servidor falla al arrancar
- **THEN** el sistema informa el fallo como texto y la sesión sigue

#### Scenario: Sin procesos huérfanos
- **WHEN** la sesión termina después de usar el servidor
- **THEN** no queda un proceso del servidor vivo
