# tools Specification

## Purpose
Las herramientas que el modelo usa para actuar sobre el mundo: leer, escribir y
editar archivos, buscarlos, y ejecutar un comando del catálogo de la plataforma
activa. Cada una declara su esquema, devuelve su contenido acotado y falla sin
tumbar el turno. Las rutas se resuelven igual en toda plataforma.

## Requirements

### Requirement: El harness lee un archivo y devuelve su contenido
El sistema SHALL leer un archivo del proyecto y devolver su contenido como texto.
El sistema SHALL admitir que la lectura se limite a un tramo del archivo. El
sistema SHALL devolver un mensaje de error cuando el archivo no exista o no pueda
leerse.

#### Scenario: El archivo existe
- **WHEN** el modelo pide leer un archivo presente en el proyecto
- **THEN** el sistema devuelve su contenido

#### Scenario: Se pide solo un tramo
- **WHEN** el modelo pide leer una porción del archivo
- **THEN** el sistema devuelve solo esa porción

#### Scenario: El archivo no existe
- **WHEN** el modelo pide leer un archivo que no está en el proyecto
- **THEN** el sistema devuelve un mensaje de error y el turno continúa

---

### Requirement: El harness escribe un archivo
El sistema SHALL crear un archivo con el contenido dado, o sobrescribir por
completo uno que ya existe. El sistema SHALL devolver un mensaje de error cuando
la ruta no sea escribible, sin modificar ningún archivo existente.

#### Scenario: El archivo no existía
- **WHEN** el modelo pide escribir en una ruta nueva
- **THEN** el sistema crea el archivo con el contenido dado

#### Scenario: El archivo ya existía
- **WHEN** el modelo pide escribir en una ruta existente
- **THEN** el sistema reemplaza su contenido completo

#### Scenario: La ruta no es escribible
- **WHEN** la ruta no permite escritura
- **THEN** el sistema devuelve un mensaje de error y ningún archivo cambia

---

### Requirement: El harness edita un archivo reemplazando una ocurrencia exacta
El sistema SHALL reemplazar en un archivo una ocurrencia exacta de un texto por
otro. El sistema SHALL modificar el archivo solo cuando el texto buscado aparezca
exactamente una vez. El sistema SHALL NOT modificar el archivo cuando el texto
aparezca más de una vez, y SHALL devolver un mensaje que indique cuántas
ocurrencias encontró. El sistema SHALL NOT modificar el archivo cuando el texto no
aparezca.

#### Scenario: El texto aparece una vez
- **WHEN** el texto a reemplazar aparece exactamente una vez en el archivo
- **THEN** el sistema lo reemplaza y devuelve el resultado

#### Scenario: El texto aparece varias veces
- **WHEN** el texto a reemplazar aparece más de una vez en el archivo
- **THEN** el sistema no modifica el archivo y devuelve cuántas ocurrencias encontró

#### Scenario: El texto no aparece
- **WHEN** el texto a reemplazar no está en el archivo
- **THEN** el sistema no modifica el archivo y devuelve un mensaje de error

---

### Requirement: El harness encuentra archivos por patrón
El sistema SHALL listar las rutas de los archivos del proyecto que coinciden con un
patrón dado. El sistema SHALL NOT incluir en el resultado archivos fuera del
directorio del proyecto. El sistema SHALL devolver una lista vacía cuando ningún
archivo coincida.

#### Scenario: Hay coincidencias
- **WHEN** el modelo pide archivos que coincidan con un patrón
- **THEN** el sistema devuelve la lista de rutas que coinciden

#### Scenario: No hay coincidencias
- **WHEN** ningún archivo del proyecto coincide con el patrón
- **THEN** el sistema devuelve una lista vacía

#### Scenario: El patrón apunta fuera del proyecto
- **WHEN** el patrón alcanza archivos fuera del directorio del proyecto
- **THEN** el sistema no los incluye en el resultado

---

### Requirement: El harness busca texto dentro de archivos
El sistema SHALL buscar una cadena dentro de los archivos del proyecto y devolver
los archivos y las líneas donde aparece. El sistema SHALL NOT abandonar la
búsqueda completa cuando un archivo no pueda leerse.

#### Scenario: Hay coincidencias
- **WHEN** el modelo busca una cadena que aparece en el proyecto
- **THEN** el sistema devuelve los archivos y las líneas donde aparece

#### Scenario: No hay coincidencias
- **WHEN** el modelo busca una cadena que no aparece en el proyecto
- **THEN** el sistema informa que no encontró coincidencias

#### Scenario: Un archivo no se puede leer
- **WHEN** un archivo del proyecto no puede leerse durante la búsqueda
- **THEN** el sistema lo omite y devuelve el resultado del resto

---

### Requirement: Cada herramienta declara su esquema
Cada herramienta SHALL declarar un esquema que describa el nombre, el tipo y la
obligatoriedad de cada uno de sus argumentos. El sistema SHALL NOT habilitar una
herramienta que no declare esquema.

#### Scenario: Alta de herramienta
- **WHEN** se da de alta una herramienta nueva
- **THEN** el sistema exige su esquema y no la habilita mientras no lo declare

#### Scenario: El esquema describe los argumentos
- **WHEN** el modelo consulta qué acepta una herramienta
- **THEN** el sistema expone los nombres, los tipos y cuáles son obligatorios

---

### Requirement: El contenido devuelto por una herramienta se trunca
El sistema SHALL truncar el contenido devuelto por una herramienta cuando supere
un máximo configurable, cuyo valor por defecto es 30.000 caracteres. El sistema
SHALL indicar que el contenido fue truncado. El sistema SHALL NOT truncar el
resultado de una herramienta que devuelva un error.

#### Scenario: El contenido excede el máximo
- **WHEN** una herramienta devuelve más contenido que el máximo
- **THEN** el sistema lo trunca e indica que fue truncado

#### Scenario: El contenido no lo excede
- **WHEN** una herramienta devuelve menos contenido que el máximo
- **THEN** el sistema lo devuelve completo

#### Scenario: El valor por defecto
- **WHEN** el sistema arranca sin configuración explícita
- **THEN** el máximo de contenido por herramienta es 30.000 caracteres

---

### Requirement: Un error de una herramienta no interrumpe el turno
Cuando una herramienta falle, el sistema SHALL devolver el fallo como resultado y
SHALL continuar el turno. El sistema SHALL NOT detener el turno ante el fallo de
una herramienta.

#### Scenario: Falla una herramienta
- **WHEN** una herramienta lanza una excepción durante su ejecución
- **THEN** el sistema devuelve el fallo y el turno continúa hacia el siguiente paso

#### Scenario: Falla la herramienta de ejecución
- **WHEN** el comando ejecutado termina con un código de salida distinto de cero
- **THEN** el sistema devuelve ese código y la salida, y el turno continúa

---

### Requirement: Las rutas se resuelven igual en toda plataforma
El sistema SHALL aceptar rutas con separador `/` y con separador `\`, y SHALL
resolverlas al mismo archivo en toda plataforma. El sistema SHALL resolver una
ruta relativa respecto del directorio del proyecto. El sistema SHALL rechazar una
ruta que apunte fuera del directorio del proyecto.

#### Scenario: Separador invertido en Windows
- **WHEN** el modelo pide un archivo con separador `/` y la plataforma activa usa `\`
- **THEN** el sistema lo encuentra igual

#### Scenario: Ruta relativa al proyecto
- **WHEN** el modelo pide un archivo con una ruta relativa
- **THEN** el sistema lo resuelve respecto del directorio del proyecto

#### Scenario: La ruta sale del proyecto
- **WHEN** el modelo pide un archivo fuera del directorio del proyecto
- **THEN** el sistema rechaza la ruta

---

### Requirement: Un comando de la lista negra no se ejecuta
El sistema SHALL rechazar antes de ejecutar todo comando que pertenezca a la lista
negra de la plataforma activa. El sistema SHALL bloquear el nombre completo del
comando y SHALL NOT intentar deducir el bloqueo a partir de las opciones que lo
acompañan. El sistema SHALL devolver al modelo un mensaje que explique el rechazo.
El sistema SHALL NOT delegar la decisión al sistema operativo.

#### Scenario: Comando bloqueado
- **WHEN** el modelo solicita un comando de la lista negra de la plataforma activa
- **THEN** el sistema lo rechaza sin ejecutarlo y devuelve el motivo al modelo como texto

#### Scenario: El bloqueo es por nombre completo
- **WHEN** un comando bloqueado se solicita con sus opciones en otro orden o en formato largo
- **THEN** el sistema lo rechaza igualmente

#### Scenario: Un comando permitido
- **WHEN** el modelo solicita un comando presente en el catálogo y fuera de la lista negra
- **THEN** el sistema lo ejecuta

### Requirement: La herramienta de ejecución se resuelve contra el catálogo de cada plataforma
El sistema SHALL ejecutar un comando solo si ese comando pertenece al catálogo de
la plataforma activa. El sistema SHALL usar el intérprete propio de la plataforma
activa; en Windows SHALL usar PowerShell. El sistema SHALL exponer la herramienta
de ejecución en Linux, macOS y Windows. El sistema SHALL rechazar antes de ejecutar
un comando que no pertenezca al catálogo, y SHALL devolver al modelo un mensaje que
indique que el comando no está disponible en esa plataforma. El sistema SHALL
evaluar la solicitud como una invocación simple y SHALL rechazar una línea que
componga varios comandos.

#### Scenario: El comando está en el catálogo
- **WHEN** el modelo solicita un comando presente en el catálogo de la plataforma activa
- **THEN** el sistema lo ejecuta con el intérprete de esa plataforma

#### Scenario: El comando no está en el catálogo
- **WHEN** el modelo solicita un comando ausente del catálogo de la plataforma activa
- **THEN** el sistema lo rechaza sin ejecutarlo y explica que no está disponible

#### Scenario: Un comando de otra plataforma
- **WHEN** el modelo solicita un comando que existe en otra plataforma pero no en la activa
- **THEN** el sistema lo rechaza en lugar de buscar un equivalente por su cuenta

#### Scenario: En Windows se usa PowerShell
- **WHEN** la plataforma activa es Windows
- **THEN** el sistema expone la herramienta y ejecuta el comando con PowerShell

#### Scenario: Un comando compuesto
- **WHEN** el modelo solicita una línea que encadena o compone varios comandos
- **THEN** el sistema la rechaza sin ejecutar y explica que solo admite una invocación simple
