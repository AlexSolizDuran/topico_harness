# Spec Delta

## ADDED Requirements

### Requirement: Una tarea se puede lanzar en background
La herramienta de delegación SHALL aceptar una solicitud de background. Con
background, SHALL iniciar la tarea y SHALL devolver el control al turno del padre
sin esperar su resultado, junto con un identificador de la tarea. Sin background,
SHALL conservar el comportamiento de espera.

#### Scenario: Lanzar una tarea en background
- **WHEN** el padre pide una tarea con background
- **THEN** la herramienta devuelve un identificador y el turno del padre sigue sin esperar

#### Scenario: Una tarea sin background espera
- **WHEN** el padre pide una tarea sin background
- **THEN** la herramienta devuelve el resultado del subagente como hasta ahora

---

### Requirement: La cantidad de tareas en background está acotada
El sistema SHALL limitar cuántas tareas en background corren a la vez. Al alcanzar
el tope, SHALL NOT iniciar otra y SHALL devolver al modelo un mensaje de error como
texto.

#### Scenario: Se rechaza la tarea que excede el tope
- **WHEN** ya hay el máximo de tareas en background y el padre pide otra
- **THEN** el sistema no la inicia y devuelve un mensaje de error

#### Scenario: Una tarea terminada libera un lugar
- **WHEN** una tarea en background termina y había alcanzado el tope
- **THEN** el padre puede iniciar otra tarea

---

### Requirement: El estado de las tareas se puede consultar
El sistema SHALL exponer una herramienta que informe el estado de una tarea por su
identificador o de todas las tareas. Para una tarea terminada SHALL incluir su
resultado. Ante un identificador desconocido SHALL devolver un mensaje de error como
texto.

#### Scenario: Consultar una tarea terminada
- **WHEN** el padre consulta una tarea terminada
- **THEN** recibe su estado y su resultado

#### Scenario: Consultar las tareas en curso
- **WHEN** el padre consulta sin identificador
- **THEN** recibe la lista de tareas con su estado

#### Scenario: Consultar una tarea inexistente
- **WHEN** el padre consulta un identificador que no existe
- **THEN** recibe un mensaje de error como texto

---

### Requirement: Una tarea en background se puede cancelar
El sistema SHALL exponer una herramienta que cancele una tarea en curso por su
identificador. La cancelación SHALL dejar la tarea en estado cancelado y SHALL NOT
cancelar otras tareas ni el turno del padre.

#### Scenario: Cancelar una tarea en curso
- **WHEN** el padre cancela una tarea que sigue en curso
- **THEN** la tarea queda cancelada y el resto sigue igual

#### Scenario: Cancelar una tarea inexistente
- **WHEN** el padre cancela un identificador que no existe
- **THEN** recibe un mensaje de error como texto

---

### Requirement: Al cerrar el turno el padre espera e inyecta los resultados
Si al terminar el turno del padre quedan tareas en background, el sistema SHALL
esperar a que terminen, SHALL incorporar sus resultados al historial del padre y
SHALL ejecutar un turno de continuación para que el modelo los use. El sistema SHALL
inyectar cada resultado una sola vez y SHALL NOT esperar cuando no hay tareas
pendientes. Si se alcanza un límite de continuaciones, el sistema SHALL detenerse y
dejar un aviso.

#### Scenario: El padre continúa con el resultado
- **WHEN** el turno del padre termina y quedan tareas en background
- **THEN** el sistema espera, inyecta los resultados y ejecuta un turno de continuación

#### Scenario: Sin tareas pendientes no hay continuación
- **WHEN** el turno del padre termina sin tareas en background
- **THEN** el sistema no ejecuta un turno adicional

#### Scenario: Un resultado se inyecta una sola vez
- **WHEN** el padre recibe el resultado de una tarea y sigue trabajando
- **THEN** ese resultado no se vuelve a inyectar en continuaciones posteriores

#### Scenario: El límite de continuaciones detiene la cadena
- **WHEN** las continuaciones alcanzan el límite configurado
- **THEN** el sistema deja de continuar y muestra un aviso

---

### Requirement: La cancelación del padre alcanza a sus tareas en background
Al cancelarse el turno del padre, el sistema SHALL cancelar sus tareas en background
en curso. Una tarea cancelada SHALL NOT inyectar un resultado de éxito.

#### Scenario: Cancelar el padre cancela las tareas
- **WHEN** el usuario cancela el turno del padre con tareas en background
- **THEN** esas tareas quedan canceladas

#### Scenario: Una tarea cancelada no reporta éxito
- **WHEN** se inyectan resultados y una tarea fue cancelada
- **THEN** su resultado se informa como cancelado, no como completado
