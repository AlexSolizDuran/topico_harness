# skills Specification

## Purpose
Las skills son procedimientos reutilizables que el agente carga solo cuando la
tarea las necesita: el catálogo se anuncia siempre y el cuerpo viaja bajo demanda.
Esta capacidad las descubre, las anuncia y las entrega sin inflar cada petición.

## Requirements

### Requirement: El sistema descubre las skills del proyecto al arrancar
El sistema SHALL descubrir las skills del proyecto al construir la sesión, leyendo
`.opencode/skills/<id>/SKILL.md` y `.opencode/skills/<id>.md` desde la raíz del
proyecto. El sistema SHALL leer del frontmatter solo `name` y `description`. El
sistema SHALL NOT leer el cuerpo durante el descubrimiento. Una skill sin
`description`, con frontmatter inválido o con un identificador que no sea un slug
válido SHALL omitirse con un aviso visible, sin impedir el arranque. Si el proyecto
no tiene skills, el sistema SHALL continuar sin error.

#### Scenario: Una skill en forma de directorio
- **WHEN** existe `.opencode/skills/git-release/SKILL.md`
- **THEN** el sistema la descubre con el identificador `git-release`

#### Scenario: Una skill en forma plana
- **WHEN** existe `.opencode/skills/revisar-pr.md`
- **THEN** el sistema la descubre con el identificador `revisar-pr`

#### Scenario: Un proyecto sin skills
- **WHEN** la raíz del proyecto no tiene `.opencode/skills`
- **THEN** la sesión arranca igual y el prompt de sistema no cambia

#### Scenario: Una skill sin descripción se omite con aviso
- **WHEN** el frontmatter de una skill no declara `description`
- **THEN** la skill se omite con un aviso visible y el arranque continúa

#### Scenario: Un identificador inválido se omite con aviso
- **WHEN** el directorio de una skill no es un slug válido
- **THEN** la skill se omite con un aviso visible y el arranque continúa

### Requirement: El sistema anuncia solo identificador, nombre y descripción
El sistema SHALL incluir en el prompt de sistema una entrada por skill descubierta
con su identificador, su nombre y su descripción. El sistema SHALL NOT incluir el
cuerpo de la skill en el prompt de sistema. El sistema SHALL NOT anunciar una skill
alcanzada por una regla `denegar`.

#### Scenario: El catálogo anuncia identificador, nombre y descripción
- **WHEN** hay una skill descubierta
- **THEN** el prompt de sistema incluye su identificador, su nombre y su descripción

#### Scenario: El cuerpo no viaja hasta la invocación
- **WHEN** el sistema envía una petición sin que el modelo haya invocado la skill
- **THEN** el cuerpo del `SKILL.md` no forma parte de la petición

#### Scenario: Una skill denegada no se anuncia
- **WHEN** una regla `denegar` alcanza la acción `skill` con el identificador de una skill
- **THEN** el prompt de sistema no menciona esa skill

### Requirement: La herramienta skill entrega el cuerpo bajo demanda
El sistema SHALL exponer una herramienta `skill` con un argumento `id`. Al
invocarla con un identificador existente SHALL devolver el cuerpo completo del
`SKILL.md`, la ruta de su directorio base y hasta diez rutas de archivos de apoyo.
Si el identificador no existe o está denegado, SHALL devolver un error como texto.
El cuerpo entregado SHALL NOT ser reemplazado por el recorte de contexto.

#### Scenario: Se invoca una skill existente
- **WHEN** el modelo invoca `skill` con un identificador existente
- **THEN** recibe el cuerpo completo, la carpeta base y las rutas de archivos de apoyo

#### Scenario: Se invoca un identificador inexistente
- **WHEN** el modelo invoca `skill` con un identificador que no existe
- **THEN** recibe un error como texto y el turno continúa

#### Scenario: Se invoca una skill denegada
- **WHEN** el modelo invoca `skill` con un identificador alcanzado por una regla `denegar`
- **THEN** recibe un error como texto y el turno continúa

#### Scenario: El recorte no enmascara el cuerpo de la skill
- **WHEN** el recorte de contexto procesa el historial con un cuerpo de skill cargado
- **THEN** ese cuerpo se conserva y no se reemplaza por el marcador de recorte

### Requirement: Las skills respetan los permisos
El sistema SHALL evaluar la invocación de una skill con la acción `skill` y el
identificador como recurso. Una regla `denegar` SHALL ocultar la skill del anuncio
y SHALL bloquear su invocación. Una regla `consultar` SHALL pedir aprobación antes
de entregar el cuerpo. Sin reglas aplicables, el sistema SHALL entregar el cuerpo
sin pedir aprobación.

#### Scenario: Una regla denegar bloquea la skill
- **WHEN** una regla `denegar` alcanza la acción `skill` con ese identificador
- **THEN** la skill no se anuncia y la invocación devuelve un error como texto

#### Scenario: Una regla consultar pide aprobación
- **WHEN** una regla `consultar` alcanza la acción `skill` con ese identificador
- **THEN** el sistema pide aprobación antes de entregar el cuerpo

#### Scenario: Sin reglas se entrega sin preguntar
- **WHEN** ninguna regla alcanza la acción `skill` con ese identificador
- **THEN** el sistema entrega el cuerpo sin pedir aprobación

### Requirement: Una skill que supera el tope falla en vez de truncarse
El sistema SHALL aceptar un `SKILL.md` de hasta 32 KiB, con un tope configurable.
Si un `SKILL.md` supera el tope, el sistema SHALL fallar el arranque con un mensaje
que nombre el archivo, su tamaño y el tope. El sistema SHALL NOT truncar el cuerpo
ni continuar en silencio.

#### Scenario: Un archivo dentro del tope
- **WHEN** un `SKILL.md` pesa el tope o menos
- **THEN** la skill se descubre y se entrega completa

#### Scenario: Un archivo justo en el tope
- **WHEN** un `SKILL.md` pesa exactamente el tope
- **THEN** el arranque no falla

#### Scenario: Un archivo que supera el tope
- **WHEN** un `SKILL.md` pesa más que el tope
- **THEN** el arranque falla con un mensaje que nombra el archivo, su tamaño y el tope

#### Scenario: No se trunca
- **WHEN** un `SKILL.md` supera el tope
- **THEN** el sistema no entrega una versión recortada del cuerpo

### Requirement: Los subagentes comparten el catálogo de skills
El sistema SHALL considerar `skill` como una herramienta de solo lectura. Un subagente
SHALL ver el mismo catálogo de skills que su agente padre y SHALL estar sujeto a
las mismas reglas de permiso. El sistema SHALL NOT admitir skills declaradas por un
agente en esta capacidad.

#### Scenario: Un subagente invoca una skill
- **WHEN** el perfil de un subagente incluye la herramienta `skill`
- **THEN** recibe el cuerpo de la skill igual que el agente padre

#### Scenario: Un subagente restringido no la ve
- **WHEN** el perfil de un subagente no incluye la herramienta `skill`
- **THEN** no puede invocarla
