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
ruta relativa respecto del directorio del proyecto. El sistema SHALL pedir
aprobación obligatoria cuando la ruta quede fuera del directorio del proyecto o
cuando un symlink la lleve fuera. El sistema SHALL NOT rechazar la ruta por sí
misma: la persona decide.

#### Scenario: Separador invertido en Windows
- **WHEN** el modelo pide un archivo con separador `/` y la plataforma activa usa `\`
- **THEN** el sistema lo encuentra igual

#### Scenario: Ruta relativa al proyecto
- **WHEN** el modelo pide un archivo con una ruta relativa
- **THEN** el sistema lo resuelve respecto del directorio del proyecto

#### Scenario: La ruta sale del proyecto
- **WHEN** el modelo pide un archivo fuera del directorio del proyecto
- **THEN** el sistema pide aprobación obligatoria y muestra la ruta

#### Scenario: Un symlink que sale del proyecto
- **WHEN** la ruta está dentro del proyecto pero un symlink la resuelve fuera
- **THEN** el sistema pide aprobación obligatoria

---

### Requirement: La herramienta de delegación declara su esquema
La herramienta de delegación SHALL declarar un esquema con el nombre del subagente y
el pedido, ambos obligatorios. El sistema SHALL limitar el nombre del subagente a los
que existen. El sistema SHALL devolver como texto un argumento que no cumpla el
esquema.

#### Scenario: La herramienta de delegación declara agente y pedido
- **WHEN** el modelo consulta qué acepta la delegación
- **THEN** el esquema expone el subagente y el pedido como obligatorios

#### Scenario: Un argumento inválido vuelve como texto
- **WHEN** el modelo envía un argumento que no cumple el esquema
- **THEN** el sistema no ejecuta la delegación y devuelve el error como texto

### Requirement: Cada herramienta declara su acción de permiso y su recurso
Cada herramienta SHALL declarar la acción de permiso que le corresponde y cómo se
obtiene el recurso sobre el que se evalúa. El sistema SHALL NOT habilitar una
herramienta que no declare ambas cosas. Escribir y editar SHALL compartir la acción
de editar; leer, buscar archivos y buscar texto SHALL tener cada uno la suya; la
ejecución SHALL usar la acción de ejecutar; la delegación SHALL usar la de delegar.

#### Scenario: El catálogo expone la acción y el recurso
- **WHEN** el sistema evalúa el permiso de una herramienta
- **THEN** obtiene la acción de la herramienta y el recurso de sus argumentos

#### Scenario: Una herramienta sin acción no se habilita
- **WHEN** se registra una herramienta que no declara su acción de permiso
- **THEN** el sistema no la habilita para el modelo

### Requirement: Cada herramienta declara si admite ejecución en paralelo
Cada herramienta SHALL declarar si es segura para ejecutarse junto a otras. Una
herramienta que no declare nada SHALL tratarse como no segura y ejecutarse sola.
Leer, buscar archivos y buscar texto SHALL declararse seguras; escribir, editar,
ejecutar y delegar SHALL declararse no seguras.

#### Scenario: Una herramienta segura se agrupa con las consecutivas
- **WHEN** el modelo pide varias llamadas consecutivas de herramientas seguras
- **THEN** el sistema las agrupa en una misma tanda

#### Scenario: Una herramienta sin declaración se ejecuta sola
- **WHEN** una herramienta no declara si admite paralelo
- **THEN** el sistema la trata como no segura y la ejecuta sola

### Requirement: El harness aplica un parche compuesto por bloques de intención
El sistema SHALL exponer una herramienta que reciba un parche formado por bloques y
aplique cada bloque sobre una ruta del proyecto. Cada bloque SHALL declarar una de
tres intenciones: agregar un archivo, actualizar un archivo o borrar un archivo. El
sistema SHALL rechazar como texto un parche vacío o un parche con un bloque
incompleto, sin modificar archivos.

#### Scenario: Un parche agrega un archivo
- **WHEN** el parche contiene un bloque de alta con su contenido
- **THEN** el sistema crea el archivo con ese contenido y lo informa en el resultado

#### Scenario: Un parche actualiza un archivo
- **WHEN** el parche contiene un bloque de actualización con líneas a quitar y a poner
- **THEN** el sistema modifica el archivo y lo informa en el resultado

#### Scenario: Un parche borra un archivo
- **WHEN** el parche contiene un bloque de borrado de un archivo existente
- **THEN** el sistema elimina el archivo y lo informa en el resultado

#### Scenario: Un parche sin bloques no modifica nada
- **WHEN** el modelo envía un parche vacío o sin bloques reconocibles
- **THEN** el sistema no modifica archivos y devuelve un mensaje de error

---

### Requirement: El parche se valida completo antes de escribir
El sistema SHALL verificar todos los bloques del parche antes de modificar el primer
archivo: rutas dentro del proyecto, existencia o inexistencia según la intención y
coincidencia de las líneas de actualización. Si un bloque no se puede aplicar, el
sistema SHALL NOT modificar ningún archivo y SHALL devolver un mensaje que identifique
el bloque y la causa.

#### Scenario: Un bloque inválido deja el resto intacto
- **WHEN** un parche tiene un bloque válido y otro cuya actualización no coincide
- **THEN** ningún archivo se modifica y el error identifica el bloque que falló

#### Scenario: Una ruta fuera del proyecto se rechaza
- **WHEN** un bloque apunta fuera del directorio del proyecto
- **THEN** el parche completo se rechaza y ningún archivo se modifica

#### Scenario: Agregar un archivo que ya existe falla
- **WHEN** un bloque declara agregar una ruta que ya existe
- **THEN** el parche completo se rechaza y el archivo existente no cambia

#### Scenario: Borrar un archivo inexistente falla
- **WHEN** un bloque declara borrar una ruta que no existe
- **THEN** el parche completo se rechaza y ningún archivo cambia

---

### Requirement: La actualización por bloques exige una coincidencia única
Para cada bloque de actualización, el sistema SHALL localizar la secuencia de líneas
de contexto y de eliminación en el archivo y SHALL aplicar el cambio solo cuando esa
secuencia aparezca exactamente una vez. El sistema SHALL NOT modificar el archivo
cuando la secuencia aparezca más de una vez y SHALL devolver cuántas coincidencias
encontró. El sistema SHALL NOT modificar el archivo cuando la secuencia no aparezca.
El sistema SHALL preservar el fin de línea original del archivo.

#### Scenario: La secuencia aparece una vez
- **WHEN** las líneas del bloque aparecen exactamente una vez en el archivo
- **THEN** el sistema aplica el cambio en ese lugar

#### Scenario: La secuencia aparece varias veces
- **WHEN** las líneas del bloque aparecen más de una vez en el archivo
- **THEN** el sistema no modifica el archivo e informa cuántas coincidencias encontró

#### Scenario: La secuencia no aparece
- **WHEN** las líneas del bloque no aparecen en el archivo
- **THEN** el sistema no modifica el archivo y devuelve un mensaje de error

#### Scenario: El fin de línea original se conserva
- **WHEN** el archivo usa un fin de línea distinto del nativo de la plataforma
- **THEN** el archivo actualizado conserva su fin de línea original

---

### Requirement: El parche declara su permiso y no admite ejecución en paralelo
La herramienta de parche SHALL declarar la acción de permiso de edición y SHALL
devolver como recurso el conjunto de rutas afectadas por el parche. La herramienta
SHALL NOT admitir ejecución en paralelo con otras llamadas de la misma tanda.

#### Scenario: El catálogo expone las rutas del parche
- **WHEN** el sistema prepara una llamada a la herramienta de parche
- **THEN** obtiene de la propia herramienta la acción de edición y todas las rutas declaradas

#### Scenario: El parche no se agrupa en una tanda
- **WHEN** el modelo pide un parche junto a otras herramientas en la misma tanda
- **THEN** el parche se ejecuta solo, sin compartir tanda con las demás

### Requirement: La herramienta de ejecución acepta un directorio de trabajo
La herramienta de ejecución SHALL aceptar un parámetro opcional `directorio`. Si
se omite, SHALL ejecutar en la raíz del proyecto. Si se indica, el sistema SHALL
resolverlo con la misma regla de rutas que las herramientas de archivo. Un
directorio fuera del proyecto o una ruta sensible SHALL pedir aprobación
obligatoria. Un directorio que no exista o que no sea un directorio SHALL volver
al modelo como texto y SHALL NOT ejecutar el comando.

#### Scenario: Un directorio dentro del proyecto
- **WHEN** el modelo indica un subdirectorio existente del proyecto
- **THEN** el comando se ejecuta con ese directorio como cwd

#### Scenario: Un directorio fuera del proyecto
- **WHEN** el modelo indica un directorio que queda fuera del proyecto
- **THEN** el sistema pide aprobación obligatoria antes de ejecutar

#### Scenario: Un directorio sensible
- **WHEN** el modelo indica un directorio dentro de `.harness`
- **THEN** el sistema pide aprobación obligatoria antes de ejecutar

#### Scenario: Un directorio inexistente
- **WHEN** el modelo indica un directorio que no existe en el proyecto
- **THEN** el sistema devuelve el error como texto y no ejecuta el comando

### Requirement: Un comando de la lista negra pide aprobación obligatoria
El sistema SHALL pedir aprobación obligatoria antes de ejecutar todo comando que
pertenezca a la lista negra de la plataforma activa. El sistema SHALL reconocer el
nombre completo del comando y SHALL NOT intentar deducir el riesgo a partir de las
opciones que lo acompañan. El motivo SHALL indicar que el comando pertenece a la
lista negra. Una regla `denegar` configurada SHALL impedir la ejecución; ninguna
regla `permitir` ni aprobación guardada SHALL saltar la aprobación. El sistema
SHALL NOT delegar la decisión al sistema operativo.

#### Scenario: Comando de la lista negra
- **WHEN** el modelo solicita un comando de la lista negra de la plataforma activa
- **THEN** el sistema pide aprobación obligatoria con el comando y el motivo a la vista

#### Scenario: El riesgo es por nombre completo
- **WHEN** un comando de la lista negra se solicita con sus opciones en otro orden o en formato largo
- **THEN** el sistema pide aprobación obligatoria igualmente

#### Scenario: Un comando permitido
- **WHEN** el modelo solicita un comando presente en el catálogo y fuera de la lista negra
- **THEN** el sistema lo ejecuta sin consultar

---

### Requirement: La herramienta de ejecución se resuelve contra el catálogo de la plataforma
El sistema SHALL usar el intérprete propio de la plataforma activa; en Windows
SHALL usar PowerShell. El sistema SHALL exponer la herramienta de ejecución en
Linux, macOS y Windows con el mismo nombre `shell`. El sistema SHALL tratar el
catálogo como la lista de comandos conocidos: un comando del catálogo SHALL
ejecutarse con la acción `shell`, y un comando fuera del catálogo SHALL pedir
aprobación obligatoria en lugar de rechazarse, con un motivo que indique que no
pertenece al catálogo de esa plataforma. En Unix el sistema SHALL admitir líneas
que compongan varios comandos con `;`, `&&`, `||` y `|`, y SHALL evaluarlas con la
acción `shell_compuesto`. En Windows una línea que componga varios comandos SHALL
pedir aprobación obligatoria. El sistema SHALL tratar como compuesta una
invocación a un intérprete que ejecute código con una bandera (`-c`, `-e`,
`--eval`) y SHALL pedir aprobación obligatoria para esa invocación. La sustitución
de comandos con `$()` o backticks SHALL pedir aprobación obligatoria.

#### Scenario: El comando está en el catálogo
- **WHEN** el modelo solicita un comando presente en el catálogo de la plataforma activa
- **THEN** el sistema lo ejecuta con el intérprete de esa plataforma

#### Scenario: El comando no está en el catálogo
- **WHEN** el modelo solicita un comando ausente del catálogo de la plataforma activa
- **THEN** el sistema pide aprobación obligatoria y explica que no pertenece al catálogo

#### Scenario: Un comando de otra plataforma
- **WHEN** el modelo solicita un comando que existe en otra plataforma pero no en la activa
- **THEN** el sistema pide aprobación obligatoria en lugar de buscar un equivalente por su cuenta

#### Scenario: En Windows se usa PowerShell
- **WHEN** la plataforma activa es Windows
- **THEN** el sistema expone la herramienta y ejecuta el comando con PowerShell

#### Scenario: Un comando compuesto
- **WHEN** el modelo solicita en Windows una línea que compone varios comandos
- **THEN** el sistema pide aprobación obligatoria

#### Scenario: Un comando compuesto en Unix
- **WHEN** el modelo solicita en Unix una línea que encadena comandos del catálogo
- **THEN** el sistema la evalúa con la acción `shell_compuesto` y la ejecuta tras la aprobación

#### Scenario: Un segmento de la lista negra pide aprobación para la línea completa
- **WHEN** una línea compuesta incluye un segmento de la lista negra
- **THEN** el sistema pide aprobación obligatoria para la línea completa con el motivo a la vista

#### Scenario: Un intérprete con -c pide aprobación obligatoria
- **WHEN** el modelo solicita `bash -c`, `sh -c`, `node -e` o `python3 -c` con código entre comillas
- **THEN** el sistema lo evalúa con la acción `shell_compuesto` y pide aprobación obligatoria

#### Scenario: La sustitución de comandos pide aprobación obligatoria
- **WHEN** la línea incluye `$()` o backticks fuera de comillas simples
- **THEN** el sistema pide aprobación obligatoria con el motivo a la vista

#### Scenario: El nombre es el mismo en todas las plataformas
- **WHEN** el modelo consulta las herramientas disponibles en Linux, macOS o Windows
- **THEN** la herramienta de ejecución aparece con el nombre `shell` en las tres

---

### Requirement: La herramienta de ejecución pide aprobación obligatoria ante una redirección
El sistema SHALL analizar la línea completa antes de ejecutar y SHALL pedir
aprobación obligatoria cuando la línea redirija a un archivo, cuando use un
heredoc, un herestring o una sustitución de proceso. El sistema SHALL NOT rechazar
la línea por la redirección: la persona decide. El sistema SHALL tratar como
invocación simple la duplicación de descriptores (`2>&1`, `n>&m`, `n>&-`) y la
redirección a `/dev/null`. Una redirección sin destino SHALL pedir aprobación
obligatoria, y el shell SHALL devolver su propio error si la línea no es válida.
En Windows toda redirección SHALL pedir aprobación obligatoria. Una redirección
SHALL evaluarse con la acción `shell_redireccion`; una línea compuesta que además
redirige SHALL conservar la acción `shell_compuesto`.

#### Scenario: Una redirección de escritura a un archivo
- **WHEN** la línea escribe en un archivo con `>`, `>>`, `>|`, `&>` o `<>`
- **THEN** el sistema pide aprobación obligatoria y muestra la línea completa

#### Scenario: Una redirección fuera del proyecto
- **WHEN** la línea escribe en una ruta fuera del proyecto
- **THEN** el sistema pide aprobación obligatoria

#### Scenario: Una redirección a un archivo sensible
- **WHEN** la línea escribe en `.env`, `.env.*` o dentro de `.harness`
- **THEN** el sistema pide aprobación obligatoria

#### Scenario: Una redirección de entrada
- **WHEN** la línea lee un archivo con `<` o `n<`
- **THEN** el sistema pide aprobación obligatoria

#### Scenario: Un heredoc
- **WHEN** la línea usa `<<`, `<<-` o `<<<`
- **THEN** el sistema pide aprobación obligatoria y no intenta validar el contenido

#### Scenario: Una sustitución de proceso
- **WHEN** la línea usa `<(…)` o `>(…)`
- **THEN** el sistema pide aprobación obligatoria

#### Scenario: La redirección a /dev/null no pide aprobación
- **WHEN** la línea redirige a `/dev/null`
- **THEN** el sistema la evalúa como invocación simple

#### Scenario: La duplicación de descriptores no pide aprobación
- **WHEN** la línea usa `2>&1`, `n>&m` o `n>&-`
- **THEN** el sistema la evalúa como invocación simple

#### Scenario: Un `>` entre comillas no es una redirección
- **WHEN** el carácter `>` aparece dentro de comillas
- **THEN** el sistema lo trata como texto y no pide aprobación

#### Scenario: Una redirección sin destino
- **WHEN** la línea termina en `>` sin un destino
- **THEN** el sistema pide aprobación obligatoria y el shell devuelve su error

#### Scenario: Una línea que solo redirige
- **WHEN** la línea no tiene comando y solo redirige a un archivo
- **THEN** el sistema pide aprobación obligatoria

#### Scenario: Una redirección en Windows
- **WHEN** la plataforma activa es Windows y la línea redirige
- **THEN** el sistema pide aprobación obligatoria

---

### Requirement: Un archivo sensible pide aprobación obligatoria
El sistema SHALL pedir aprobación obligatoria cuando una herramienta de archivo
lea o escriba `.env`, un archivo `*.env.*` o una ruta dentro de `.harness/`. El
sistema SHALL NOT pedir aprobación para `*.env.example`. El motivo SHALL nombrar
la ruta. La aprobación SHALL ser obligatoria aunque una regla permita la acción.

#### Scenario: Un archivo .env
- **WHEN** el modelo lee o escribe `.env`
- **THEN** el sistema pide aprobación obligatoria y nombra la ruta

#### Scenario: Un archivo .env.local
- **WHEN** el modelo lee o escribe `.env.local`
- **THEN** el sistema pide aprobación obligatoria

#### Scenario: El config local del harness
- **WHEN** el modelo lee o escribe `.harness/config.json`
- **THEN** el sistema pide aprobación obligatoria

#### Scenario: Un archivo .env.example
- **WHEN** el modelo lee `.env.example`
- **THEN** el sistema no pide aprobación
