# Spec Delta

## Purpose

Conserva la conversación entre procesos: guarda cada turno de forma incremental,
permite reanudar una sesión con su historial y su configuración, y acota cuántas
sesiones se retienen por proyecto.

## ADDED Requirements

### Requirement: La sesión se guarda de forma incremental al cerrar cada turno
Al terminar un turno, el sistema SHALL agregar a la sesión activa un registro con
los mensajes producidos por ese turno. El sistema SHALL NOT reescribir registros
anteriores. Cada registro SHALL ocupar una línea completa e independiente. El
sistema SHALL registrar también el estado final del turno.

#### Scenario: Un turno completado se guarda
- **WHEN** un turno termina con estado completado
- **THEN** sus mensajes quedan agregados a la sesión activa

#### Scenario: Un turno cancelado se guarda
- **WHEN** el usuario cancela un turno y el turno cierra con estado cancelado
- **THEN** los mensajes producidos hasta la cancelación quedan agregados a la sesión

#### Scenario: Los registros anteriores no se reescriben
- **WHEN** se guarda un turno nuevo sobre una sesión con turnos previos
- **THEN** los registros anteriores permanecen intactos

---

### Requirement: Un registro incompleto se descarta sin romper la sesión
Al cargar una sesión, si el último registro está incompleto o no se puede
interpretar, el sistema SHALL descartarlo y SHALL cargar los registros anteriores.
Si un registro inválido no es el último, el sistema SHALL NOT descartarlo en
silencio y SHALL devolver un error de carga.

#### Scenario: Un corte a mitad del último turno
- **WHEN** el proceso muere mientras escribe el último turno y ese registro queda incompleto
- **THEN** al cargar se descarta ese turno y la sesión anterior sigue disponible

#### Scenario: Un registro corrupto en el medio
- **WHEN** un registro intermedio no se puede interpretar
- **THEN** la carga falla y devuelve un error en lugar de perder datos en silencio

---

### Requirement: Al reanudar se restauran el historial y la configuración
El sistema SHALL permitir reanudar una sesión guardada y SHALL continuar con su
historial de mensajes. SHALL restaurar el modelo, el agente y el directorio con los
que se guardó. Al reanudar SHALL NOT agregar un mensaje de usuario que no exista en
los registros.

#### Scenario: Reanudar conserva el historial
- **WHEN** se reanuda una sesión con turnos previos
- **THEN** el siguiente turno se envía con ese historial y sin inventar mensajes

#### Scenario: Reanudar restaura el modelo y el agente
- **WHEN** la sesión se guardó con un modelo y un agente distintos de los iniciales
- **THEN** al reanudar quedan activos ese modelo y ese agente

#### Scenario: Reanudar funciona sin terminal interactiva
- **WHEN** se reanuda una sesión desde la línea de comandos sin terminal interactiva
- **THEN** el historial se restaura igual y el turno se ejecuta en modo línea a línea

---

### Requirement: La credencial nunca se escribe en la sesión
Antes de persistir cualquier texto, el sistema SHALL redactar la credencial
configurada. El sistema SHALL NOT escribir la credencial en los metadatos ni en los
registros de la sesión.

#### Scenario: Un resultado que contiene la credencial se guarda redactado
- **WHEN** un resultado de herramienta incluye la credencial configurada
- **THEN** el registro guardado contiene la credencial redactada

---

### Requirement: Se pueden listar y elegir sesiones guardadas
El sistema SHALL listar las sesiones del proyecto con su identificador, fecha de
actualización, modelo y cantidad de mensajes, ordenadas de la más reciente a la más
antigua. El sistema SHALL permitir cargar una sesión por identificador o la última
del proyecto. El sistema SHALL rechazar como texto un identificador inexistente.

#### Scenario: Se listan las sesiones del proyecto
- **WHEN** el usuario pide la lista de sesiones
- **THEN** recibe las sesiones del proyecto ordenadas por actualización descendente

#### Scenario: Se carga la última sesión
- **WHEN** el usuario pide continuar sin indicar identificador
- **THEN** se carga la sesión del proyecto actualizada más recientemente

#### Scenario: Un identificador inexistente vuelve como error
- **WHEN** el usuario pide una sesión cuyo identificador no existe
- **THEN** el sistema no cambia de sesión y devuelve un mensaje de error

---

### Requirement: Una sesión nueva no hereda el historial de la anterior
El sistema SHALL crear una sesión nueva con historial vacío. El sistema SHALL NOT
copiar mensajes de la sesión anterior. La sesión anterior SHALL permanecer
disponible.

#### Scenario: Crear una sesión nueva
- **WHEN** el usuario pide una sesión nueva
- **THEN** la sesión activa arranca sin mensajes y la anterior sigue guardada

---

### Requirement: El guardado se puede desactivar
El sistema SHALL guardar las sesiones por defecto. El sistema SHALL permitir
desactivar el guardado por configuración. Con el guardado desactivado, el sistema
SHALL NOT crear archivos de sesión ni modificar los existentes.

#### Scenario: El guardado desactivado no escribe
- **WHEN** la configuración desactiva el guardado
- **THEN** un turno no crea ni modifica archivos de sesión

#### Scenario: El guardado activo escribe por defecto
- **WHEN** la configuración no dice nada sobre el guardado
- **THEN** un turno terminado queda guardado

---

### Requirement: La compactación reemplaza el historial al reanudar
Cuando el historial se compacta, el sistema SHALL agregar un registro que indique
el nuevo historial vigente. Al reanudar, el sistema SHALL usar ese reemplazo y
SHALL NOT reconstruir el historial anterior a la compactación.

#### Scenario: Reanudar después de compactar no revive el historial viejo
- **WHEN** una sesión se compactó y después se reanuda
- **THEN** el historial cargado es el compactado, no el original

---

### Requirement: La cantidad de sesiones guardadas está acotada
El sistema SHALL permitir configurar un máximo de sesiones por proyecto. Al crear
una sesión nueva por encima del máximo, el sistema SHALL eliminar las sesiones más
antiguas y SHALL NOT eliminar la sesión activa.

#### Scenario: Se eliminan las sesiones más antiguas
- **WHEN** se crea una sesión nueva y ya se alcanzó el máximo configurado
- **THEN** se eliminan las sesiones más antiguas y la nueva queda guardada

#### Scenario: La sesión activa no se elimina
- **WHEN** la poda alcanza a la sesión activa
- **THEN** el sistema la conserva y elimina otra más antigua
