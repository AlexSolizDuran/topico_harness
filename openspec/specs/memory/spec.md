# memory Specification

## Purpose
La memoria es el contexto aprendido que sobrevive entre sesiones: hechos del
proyecto que no se deducen leyendo el código. Esta capacidad los carga al
arrancar, los inyecta en el prompt, los extrae al cerrar y los mantiene curados y
acotados.

## Requirements

### Requirement: El sistema carga la memoria del proyecto al arrancar
Al construir la sesión, el sistema SHALL leer el índice de memoria del proyecto y
SHALL cargar el detalle de forma diferida. SHALL cargar el índice siempre y el
detalle solo cuando haga falta. SHALL NOT cargar memoria de otro proyecto. La
ausencia de memoria SHALL NOT impedir el arranque.

#### Scenario: Un proyecto con memoria
- **WHEN** el proyecto tiene un índice de memoria
- **THEN** el sistema carga el índice al arrancar

#### Scenario: Un proyecto sin memoria
- **WHEN** el proyecto no tiene directorio de memoria
- **THEN** la sesión arranca igual y no se informa un error

#### Scenario: El detalle se carga bajo demanda
- **WHEN** el modelo necesita un detalle que no está en el índice
- **THEN** el sistema lo carga desde su archivo sin cargar todos los detalles

#### Scenario: No se mezcla con otro proyecto
- **WHEN** la sesión trabaja en un proyecto con memoria propia
- **THEN** el sistema no inyecta la memoria de otro proyecto

### Requirement: La memoria se distingue de las instrucciones y del historial
El sistema SHALL tratar las instrucciones del proyecto como contexto estable y la
memoria como contexto aprendido. SHALL NOT escribir hechos aprendidos en las
instrucciones. SHALL NOT presentar la memoria como parte del historial de la
conversación. El sistema SHALL indicar el origen y la fecha de una entrada cuando
estén disponibles.

#### Scenario: Instrucciones y memoria son contextos distintos
- **WHEN** la sesión arranca con instrucciones y memoria
- **THEN** cada una se identifica por separado en el prompt

#### Scenario: La memoria no se escribe en las instrucciones
- **WHEN** el sistema aprende un hecho nuevo
- **THEN** lo escribe en la memoria y no modifica las instrucciones del proyecto

#### Scenario: La memoria no es historial
- **WHEN** el modelo lee la memoria
- **THEN** la recibe como un bloque de sistema y no como un mensaje previo de la conversación

#### Scenario: El origen es visible
- **WHEN** una entrada de memoria tiene origen y fecha
- **THEN** el bloque inyectado los muestra

### Requirement: La memoria se inyecta con marcador y entra en el presupuesto
La memoria SHALL inyectarse como un bloque de sistema marcado como memoria, no
como hechos verificados en la conversación. El bloque SHALL contar en el
presupuesto de contexto. Si el bloque no cabe, el sistema SHALL aplicar el mismo
pipeline de contexto que al resto del historial y SHALL NOT truncar la memoria en
silencio.

#### Scenario: Bloque marcado como memoria
- **WHEN** el sistema inyecta memoria en el prompt
- **THEN** el bloque se identifica como memoria y no como un hecho verificado

#### Scenario: La memoria cuenta en el presupuesto
- **WHEN** se calcula el uso del contexto
- **THEN** el bloque de memoria se incluye en el conteo

#### Scenario: La memoria no se trunca en silencio
- **WHEN** el bloque de memoria no cabe en el presupuesto
- **THEN** el sistema aplica el pipeline de contexto y avisa, en vez de recortar la memoria sin informar

### Requirement: Al cerrar la sesión se extraen hechos no deducibles
Al cerrar la sesión, el sistema SHALL ejecutar una extracción sobre el transcript
con un modelo de bajo costo. SHALL guardar solo hechos concretos que no se
deduzcan leyendo el código: convenciones, decisiones, errores ya intentados y
ubicaciones no obvias. SHALL descartar lo obvio y lo deducible. La escritura SHALL
ser atómica y un fallo SHALL NOT impedir el cierre.

#### Scenario: Se extrae una convención
- **WHEN** la sesión usó una convención que no se deduce del código
- **THEN** la extracción la guarda en la memoria

#### Scenario: Se descarta lo obvio
- **WHEN** el transcript solo contiene pedidos y acciones evidentes
- **THEN** la extracción no guarda esas entradas

#### Scenario: Se descarta lo deducible del código
- **WHEN** un hecho se puede obtener leyendo el código
- **THEN** la extracción no lo guarda en la memoria

#### Scenario: Un fallo de extracción no impide cerrar
- **WHEN** la extracción falla al cerrar la sesión
- **THEN** la sesión se cierra igual y el fallo se informa

#### Scenario: La escritura es atómica
- **WHEN** la extracción escribe varias entradas
- **THEN** o se escriben todas o no se escribe ninguna, sin dejar archivos a medias

#### Scenario: La escritura directa respeta la acción edit
- **WHEN** el modelo escribe o edita un archivo de memoria
- **THEN** la operación se evalúa con la acción de permiso `edit`

### Requirement: La memoria se puede curar y editar a mano
La memoria SHALL organizarse en un índice pequeño y archivos de detalle
separados. SHALL poder editarse a mano sin un formato propietario. El sistema
SHALL marcar o eliminar entradas obsoletas y contradicciones cuando se detecten.
El índice SHALL mantenerse acotado y el detalle SHALL quedar fuera de la carga
inicial.

#### Scenario: Índice y detalle
- **WHEN** la memoria tiene muchas entradas
- **THEN** el índice se mantiene chico y el detalle vive en archivos separados

#### Scenario: Edición manual
- **WHEN** la persona edita un archivo de memoria
- **THEN** el sistema lo lee en la sesión siguiente sin un paso de importación

#### Scenario: Entrada obsoleta
- **WHEN** una entrada de memoria ya no es cierta
- **THEN** la persona puede eliminarla o el sistema la marca como obsoleta

#### Scenario: Contradicción
- **WHEN** dos entradas de memoria se contradicen
- **THEN** el sistema marca la más vieja como superada en vez de usar ambas

### Requirement: El ámbito de la memoria es el proyecto y, opcionalmente, el usuario
La memoria del proyecto SHALL vivir con el proyecto y SHALL ser la opción por
defecto. El sistema MAY admitir una memoria de usuario para preferencias
personales. SHALL NOT mezclar la memoria de un proyecto con la de otro. Una
preferencia de usuario SHALL NOT sobrescribir un hecho del proyecto sin marcarlo.

#### Scenario: Memoria de proyecto por defecto
- **WHEN** el proyecto declara memoria sin configurar un ámbito
- **THEN** la memoria se guarda con el proyecto

#### Scenario: Memoria de usuario opcional
- **WHEN** la configuración declara memoria de usuario
- **THEN** el sistema la lee además de la del proyecto y las mantiene separadas

#### Scenario: No se mezclan proyectos
- **WHEN** la sesión cambia de proyecto
- **THEN** no aparecen entradas del proyecto anterior

#### Scenario: Precedencia marcada
- **WHEN** una preferencia de usuario coincide con un hecho del proyecto
- **THEN** el sistema conserva el hecho del proyecto y muestra la preferencia como tal

### Requirement: Un archivo de memoria que supera el tope falla en vez de truncarse
El sistema SHALL aplicar un tope configurable a cada archivo de memoria y al
total. Si una escritura supera el tope, SHALL fallar con un error explícito que
nombre el archivo, el tamaño y el tope. SHALL NOT truncar la memoria en silencio.
La persona SHALL poder corregir el archivo y reintentar.

#### Scenario: Un archivo dentro del tope
- **WHEN** un archivo de memoria está por debajo del tope
- **THEN** el sistema lo escribe normalmente

#### Scenario: Un archivo justo en el tope
- **WHEN** un archivo de memoria alcanza exactamente el tope
- **THEN** el sistema lo acepta

#### Scenario: Un archivo que supera el tope
- **WHEN** una escritura de memoria supera el tope
- **THEN** el sistema falla con un error que nombra archivo, tamaño y tope

#### Scenario: No se trunca
- **WHEN** la escritura supera el tope
- **THEN** el sistema no guarda una versión truncada del contenido
