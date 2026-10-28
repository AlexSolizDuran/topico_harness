# Spec Delta

## REMOVED Requirements

### Requirement: Un comando de la lista negra no se ejecuta
**Reason**: La lista negra ya no rechaza. Eleva la operación a una aprobación
obligatoria que la persona resuelve. El nombre y los escenarios describían un
bloqueo que el sistema ya no aplica.
**Migration**: Lo reemplaza «Un comando de la lista negra pide aprobación
obligatoria». La lista negra por nombre completo se conserva como dato de riesgo.

### Requirement: La herramienta de ejecución se resuelve contra el catálogo de cada plataforma
**Reason**: El catálogo deja de ser un muro. Un comando fuera del catálogo, una
redirección y la sustitución de comandos piden aprobación obligatoria en lugar de
rechazarse.
**Migration**: Lo reemplaza «La herramienta de ejecución se resuelve contra el
catálogo de la plataforma». El catálogo por plataforma se conserva como dato de
riesgo y la ejecución sigue usando el intérprete de cada plataforma.

## MODIFIED Requirements

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

## ADDED Requirements

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
