# instructions Specification

## Purpose
Las instrucciones del proyecto son el contexto estable que el agente necesita en
cada sesión: convenciones, comandos de verificación y estructura. Esta capacidad
las carga al arrancar, las conserva durante la sesión y falla de forma visible
cuando no caben.

## Requirements

### Requirement: El harness carga las instrucciones del proyecto al arrancar
El sistema SHALL leer `AGENTS.md` de la raíz del proyecto al construir la sesión y
SHALL inyectar su contenido en el prompt de sistema. Si el archivo no existe, el
sistema SHALL continuar sin error. Si el archivo no tiene contenido, el sistema
SHALL NOT modificar el prompt. El sistema SHALL NOT leer como instrucciones
archivos del proyecto que no se llamen `AGENTS.md`.

#### Scenario: Un proyecto con AGENTS.md
- **WHEN** la raíz del proyecto tiene un `AGENTS.md`
- **THEN** el prompt de sistema incluye su contenido

#### Scenario: Un proyecto sin AGENTS.md
- **WHEN** la raíz del proyecto no tiene `AGENTS.md`
- **THEN** la sesión arranca igual y el prompt de sistema no cambia

#### Scenario: Un AGENTS.md vacío
- **WHEN** `AGENTS.md` existe pero no tiene contenido
- **THEN** el prompt de sistema no cambia

#### Scenario: Otros archivos no son instrucciones
- **WHEN** la raíz del proyecto tiene otros archivos Markdown
- **THEN** el sistema no los lee como instrucciones

### Requirement: Las instrucciones se leen una vez y se conservan
El sistema SHALL leer `AGENTS.md` una sola vez por sesión y SHALL NOT releerlo en
cada turno. La composición del prompt SHALL ser el prompt base, después las
instrucciones del proyecto y al final el prompt del agente. Reanudar una sesión y
cambiar de agente SHALL conservar las instrucciones cargadas.

#### Scenario: Varios turnos
- **WHEN** la sesión ejecuta varios turnos
- **THEN** el sistema lee `AGENTS.md` una sola vez

#### Scenario: Se reanuda la sesión
- **WHEN** la persona reanuda una sesión guardada
- **THEN** las instrucciones del proyecto siguen en el prompt

#### Scenario: Se cambia de agente
- **WHEN** la persona cambia de agente primario
- **THEN** las instrucciones del proyecto se conservan y el prompt del agente queda al final

#### Scenario: El prompt del agente especializa
- **WHEN** el agente activo declara su propio prompt
- **THEN** el prompt de sistema conserva las instrucciones del proyecto antes del prompt del agente

### Requirement: Un AGENTS.md que supera el tope falla en vez de truncarse
El sistema SHALL aceptar un `AGENTS.md` de hasta un tope configurable cuyo valor
por defecto es 32 KiB. Si el archivo supera el tope, el sistema SHALL fallar el
arranque con un mensaje que nombre el archivo, su tamaño y el tope. El sistema
SHALL NOT truncar el contenido ni continuar en silencio.

#### Scenario: Un archivo dentro del tope
- **WHEN** `AGENTS.md` pesa el tope o menos
- **THEN** la sesión arranca y el contenido se inyecta completo

#### Scenario: Un archivo justo en el tope
- **WHEN** `AGENTS.md` pesa exactamente el tope
- **THEN** la sesión arranca sin error

#### Scenario: Un archivo que supera el tope
- **WHEN** `AGENTS.md` pesa más que el tope
- **THEN** el arranque falla con un mensaje que nombra el archivo, su tamaño y el tope

#### Scenario: No se trunca
- **WHEN** `AGENTS.md` supera el tope
- **THEN** el sistema no inyecta una versión recortada del archivo

### Requirement: El sistema carga el AGENTS.md más cercano al explorar una carpeta
Cuando una herramienta de archivo accede a una ruta concreta, el sistema SHALL
buscar `AGENTS.md` en el directorio de esa ruta y en sus ancestros hasta la raíz
del proyecto, y SHALL cargar los que todavía no estén cargados. Un `glob` SHALL
disparar la carga solo cuando su patrón declare un prefijo de directorio. El
sistema SHALL NOT cargar instrucciones por `grep` ni por `shell`. El sistema SHALL
NOT cargar archivos de directorios que el agente no exploró.

#### Scenario: Se lee un archivo en una subcarpeta con AGENTS.md
- **WHEN** el agente lee un archivo de `packages/web` y esa carpeta tiene `AGENTS.md`
- **THEN** el sistema carga `packages/web/AGENTS.md`

#### Scenario: Se lee en una subcarpeta sin archivo propio
- **WHEN** el agente lee un archivo de `packages/api/src` y solo existe `packages/AGENTS.md`
- **THEN** el sistema carga `packages/AGENTS.md`

#### Scenario: Un glob con prefijo de directorio
- **WHEN** el agente ejecuta un `glob` con un patrón que empieza en `packages/web`
- **THEN** el sistema carga el `AGENTS.md` de esa carpeta si existe

#### Scenario: Un glob sin prefijo no dispara la carga
- **WHEN** el agente ejecuta un `glob` con un patrón que recorre todo el proyecto
- **THEN** el sistema no carga ningún `AGENTS.md` por esa búsqueda

#### Scenario: Una búsqueda de texto no dispara la carga
- **WHEN** el agente ejecuta `grep` sobre el proyecto
- **THEN** el sistema no carga ningún `AGENTS.md` por esa búsqueda

#### Scenario: Un comando shell no dispara la carga
- **WHEN** el agente ejecuta `shell` sobre un archivo de una subcarpeta
- **THEN** el sistema no carga el `AGENTS.md` de esa carpeta

#### Scenario: Una carpeta no explorada no se carga
- **WHEN** el agente nunca accede a `packages/api`
- **THEN** `packages/api/AGENTS.md` no forma parte del prompt

### Requirement: La carga de instrucciones es única y deduplicada
El sistema SHALL cargar cada archivo una sola vez por sesión, identificándolo por
su ruta real. El sistema SHALL NOT recargarlo al volver a la misma carpeta. Una
compactación SHALL NOT provocar una recarga.

#### Scenario: Segunda lectura de la misma carpeta
- **WHEN** el agente lee un segundo archivo de una carpeta ya explorada
- **THEN** el sistema no vuelve a cargar su `AGENTS.md`

#### Scenario: Dos rutas de la misma carpeta en un paso
- **WHEN** una tanda de herramientas toca dos archivos de la misma carpeta
- **THEN** el sistema carga ese `AGENTS.md` una sola vez

#### Scenario: Después de una compactación
- **WHEN** el historial se compacta y el agente vuelve a una carpeta ya explorada
- **THEN** el sistema no recarga su `AGENTS.md`

### Requirement: La precedencia va de la raíz a la carpeta más específica
El prompt de sistema SHALL ordenar las instrucciones desde la raíz del proyecto
hacia la carpeta más específica cargada, y SHALL dejar el prompt del agente al
final.

#### Scenario: Dos niveles de instrucciones
- **WHEN** se cargaron `AGENTS.md` y `packages/AGENTS.md`
- **THEN** el de la raíz aparece primero

#### Scenario: Tres niveles de instrucciones
- **WHEN** se sumó `packages/web/AGENTS.md`
- **THEN** el orden es raíz, después `packages`, después `packages/web`

#### Scenario: El prompt del agente queda al final
- **WHEN** el agente activo declara su propio prompt
- **THEN** ese prompt aparece después de todas las instrucciones del proyecto

### Requirement: El conjunto de instrucciones respeta un tope total
El sistema SHALL aplicar el tope por archivo de 32 KiB y un tope total configurable
de 64 KiB. Si al cargar un archivo nuevo se supera el tope total, el sistema SHALL
devolver un error como texto al modelo y SHALL NOT inyectar el archivo. El turno
SHALL continuar.

#### Scenario: El total está dentro del tope
- **WHEN** las instrucciones cargadas suman el tope total o menos
- **THEN** el sistema las inyecta todas

#### Scenario: Un archivo empuja el total sobre el tope
- **WHEN** cargar un archivo nuevo supera el tope total
- **THEN** el sistema devuelve un error como texto, no lo inyecta y el turno continúa

#### Scenario: Un archivo individual sobre el tope
- **WHEN** el `AGENTS.md` de una carpeta pesa más que el tope por archivo
- **THEN** el sistema devuelve un error como texto y no lo inyecta

### Requirement: La carga de instrucciones es visible y se contabiliza
El sistema SHALL emitir un evento por cada archivo cargado con su ruta, su tamaño y
sus tokens estimados. La interfaz SHALL mostrar ese evento. El costo SHALL sumarse
al prompt de sistema en las métricas de contexto.

#### Scenario: La interfaz muestra la carga
- **WHEN** el sistema carga un `AGENTS.md` anidado
- **THEN** la interfaz muestra un aviso con la ruta del archivo

#### Scenario: El costo entra en las métricas
- **WHEN** se recalcula el contexto después de una carga
- **THEN** los tokens del prompt de sistema incluyen el archivo nuevo

#### Scenario: El panel de contexto lo refleja
- **WHEN** la persona abre el panel de contexto
- **THEN** el uso mostrado incluye las instrucciones cargadas
