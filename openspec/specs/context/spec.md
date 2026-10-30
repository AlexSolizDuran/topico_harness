# context Specification

## Purpose
Lo que evita que un turno largo degrade al modelo. Mantiene un presupuesto de
contexto con margen conservador, recorta primero las salidas viejas de las
herramientas, y solo resume cuando el recorte no alcanza. Tres reglas no se rompen:
el prompt del sistema no se descarta, el historial nunca se parte entre una
herramienta y su respuesta, y el resumen se marca como generado.

## Requirements

### Requirement: El sistema mantiene un presupuesto de contexto con margen conservador
El sistema SHALL mantener un presupuesto de tokens para el turno, cuyo límite sea
configurable y cuyo valor por defecto sea el 80% de la ventana de contexto del
modelo. El sistema SHALL conservar el margen restante sin usarlo. El sistema SHALL
NOT enviar al provider una petición que supere su límite. El sistema SHALL
verificar el presupuesto antes de cada petición, incluidos los pasos intermedios
de un turno.

#### Scenario: Se alcanza el presupuesto
- **WHEN** el historial del turno alcanza el límite del presupuesto
- **THEN** el sistema deja de acumular contexto antes de enviar otra petición

#### Scenario: El valor por defecto
- **WHEN** el sistema arranca sin configuración explícita
- **THEN** el límite del presupuesto es el 80% de la ventana de contexto del modelo

#### Scenario: El margen se conserva
- **WHEN** el historial ocupa el límite del presupuesto
- **THEN** el sistema no envía una petición que lo supere

#### Scenario: Un turno con varios pasos
- **WHEN** un turno ejecuta herramientas y el historial crece entre pasos
- **THEN** el sistema verifica el presupuesto antes de cada petición y no envía
  una que supere el límite

### Requirement: El presupuesto se alimenta del conteo del provider con respaldo estimado
El sistema SHALL alimentar el presupuesto con el conteo de tokens que el provider
reporta. Cuando el provider no reporte ese conteo, el sistema SHALL estimarlo a
partir del largo del texto y SHALL incluir el prompt de sistema en esa
estimación. El sistema SHALL estimar con margen deliberadamente conservador y
SHALL NOT usar la estimación como si fuera exacta.

#### Scenario: El provider reporta el conteo
- **WHEN** el provider reporta el conteo de tokens de la respuesta
- **THEN** el sistema lo usa para actualizar el presupuesto

#### Scenario: El provider no lo reporta
- **WHEN** una respuesta llega sin conteo de tokens
- **THEN** el sistema estima a partir del largo del texto y lo usa como respaldo

#### Scenario: La estimación no se presenta como exacta
- **WHEN** el presupuesto se actualizó con un valor estimado
- **THEN** el sistema lo trata como aproximado y no como el conteo del provider

#### Scenario: La estimación incluye el prompt de sistema
- **WHEN** el sistema estima el uso y el prompt de sistema tiene contenido
- **THEN** la estimación incluye el costo de ese prompt

### Requirement: Al acercarse al límite el sistema recorta salidas viejas de herramientas
Cuando el historial alcance el umbral de recorte, el sistema SHALL reemplazar el
contenido de resultados de herramientas antiguas y grandes por una marca que indique
cómo recuperarlos. El sistema SHALL NOT recortar mensajes del usuario ni respuestas
del modelo. El sistema SHALL NOT recortar el contenido de una herramienta cuyo
resultado el modelo todavía no recibió. El sistema SHALL NOT recortar resultados
menores que un tamaño mínimo. La marca SHALL indicar la herramienta y el argumento
con los que se puede recuperar el contenido.

#### Scenario: Herramienta antigua recortada
- **WHEN** el historial se acerca al límite y hay resultados de herramientas de pasos anteriores
- **THEN** el sistema reemplaza esos contenidos por una marca de recortado

#### Scenario: Los mensajes del usuario se conservan
- **WHEN** el sistema recorta por cercanía al límite
- **THEN** conserva íntegros los mensajes del usuario

#### Scenario: No se recorta lo que el modelo acaba de ver
- **WHEN** el resultado de una herramienta todavía no fue entregado al modelo
- **THEN** el sistema no lo recorta

#### Scenario: El marcador dice cómo recuperar
- **WHEN** el sistema recorta el resultado de una herramienta
- **THEN** la marca nombra la herramienta y el argumento para volver a obtenerlo

#### Scenario: Una salida pequeña no se recorta
- **WHEN** un resultado de herramienta pesa menos que el tamaño mínimo
- **THEN** el sistema lo conserva aunque sea antiguo

#### Scenario: El recorte es recuperable
- **WHEN** el modelo necesita el contenido recortado
- **THEN** la marca le indica con qué llamada puede volver a obtenerlo

### Requirement: Cuando el recorte no alcanza el sistema resume el historial
Cuando el recorte y la poda no mantengan el historial dentro del presupuesto, el
sistema SHALL reemplazar los turnos más antiguos por un resumen. El sistema SHALL
resumir primero el bloque más antiguo que supere el tamaño mínimo y SHALL compactar
el historial completo solo al alcanzar el umbral de compactación. El sistema SHALL
conservar los turnos más recientes sin resumir. El sistema SHALL resumir solo al
final de un turno, cuando el modelo ya terminó de producir. El sistema SHALL repetir
la compactación mientras el historial siga fuera del presupuesto y queden turnos para
resumir. El sistema SHALL NOT acumular más de un resumen automático: al compactar de
nuevo SHALL reemplazar el resumen anterior por uno nuevo. Si el resumen de un bloque
falla, el sistema SHALL conservar el historial intacto e informar el fallo.

#### Scenario: El recorte no basta
- **WHEN** el historial sigue fuera del presupuesto después de recortar resultados viejos
- **THEN** el sistema resume los turnos más antiguos

#### Scenario: Los turnos recientes se conservan
- **WHEN** el sistema resume el historial
- **THEN** conserva íntegros los turnos más recientes

#### Scenario: La compactación espera al final del turno
- **WHEN** el modelo todavía está produciendo dentro del turno
- **THEN** el sistema no compacta y espera a que termine

#### Scenario: La compactación se repite
- **WHEN** después de una compactación el historial sigue fuera del presupuesto
- **THEN** el sistema vuelve a compactar mientras queden turnos para resumir

#### Scenario: El resumen no se duplica
- **WHEN** el sistema compacta un historial que ya tiene un resumen automático
- **THEN** reemplaza ese resumen y deja un solo mensaje de resumen

#### Scenario: El presupuesto no se puede satisfacer
- **WHEN** el historial sigue fuera del presupuesto y no quedan turnos para resumir
- **THEN** el sistema deja de compactar e informa que el presupuesto no se pudo
  satisfacer

#### Scenario: Se resume un bloque antes de compactar todo
- **WHEN** el historial alcanza el umbral de resumen y todavía no el de compactación
- **THEN** el sistema resume solo el bloque más antiguo y conserva el resto

#### Scenario: Un resumen fallido no destruye el historial
- **WHEN** el resumen de un bloque no se puede generar
- **THEN** el sistema conserva el historial intacto e informa el fallo

### Requirement: El resumen conserva decisiones concretas y no narrativa
El sistema SHALL incluir en el resumen las decisiones tomadas y los hechos
verificados. El sistema SHALL NOT reducir el historial a una descripción de las
acciones realizadas. El sistema SHALL NOT afirmar en el resumen nada que el sistema
no haya observado.

#### Scenario: El resumen nombra el archivo y la línea
- **WHEN** el sistema resume una búsqueda que encontró un patrón
- **THEN** el resumen registra dónde está el patrón, no que el asistente buscó

#### Scenario: El resumen no narra
- **WHEN** el sistema resume un turno
- **THEN** no dice solamente qué se hizo, sino qué quedó establecido

---

### Requirement: El prompt del sistema nunca se descarta
El sistema SHALL conservar el prompt del sistema durante todo el turno. Ninguna
operación de recorte, resumen o compactación SHALL eliminarlo ni acortarlo. El
sistema SHALL preservarlo incluso cuando el presupuesto esté agotado.

#### Scenario: El presupuesto está lleno
- **WHEN** el presupuesto está en su límite y el prompt del sistema es la parte más antigua
- **THEN** el sistema lo conserva íntegro y descarta otra cosa

#### Scenario: Hay que compactar
- **WHEN** el sistema compacta el historial
- **THEN** el prompt del sistema sigue presente sin modificar

---

### Requirement: El historial nunca se corta entre una herramienta y su respuesta
El sistema SHALL conservar siempre la secuencia completa que va desde una solicitud
de herramienta hasta el resultado que la responde. Ninguna operación de recorte o
resumen SHALL dejar el historial con un resultado de herramienta sin su solicitud,
ni con una solicitud sin su resultado.

#### Scenario: Recorte en el medio de una secuencia
- **WHEN** el sistema recorta y el punto de corte cae entre una solicitud y su resultado
- **THEN** el sistema desplaza el corte para no partir la secuencia

#### Scenario: El historial resultante sigue siendo válido
- **WHEN** el sistema terminó de recortar o resumir
- **THEN** puede enviar el historial resultante sin que el provider lo rechace

---

### Requirement: El resumen se marca como generado automáticamente
El sistema SHALL marcar explícitamente el texto que produce como resumen. El
sistema SHALL indicar que ese texto fue generado automáticamente y no verificado.
El sistema SHALL NOT presentar un resumen como si fueran hechos comprobados.

#### Scenario: El modelo lee un resumen
- **WHEN** el modelo recibe un historial que contiene un resumen
- **THEN** el resumen aparece identificado como generado automáticamente

#### Scenario: El resumen no se toma por verificado
- **WHEN** el modelo cita algo que viene de un resumen
- **THEN** el sistema no lo presenta como un hecho comprobado

---

### Requirement: La compactación ocurre al final de un turno
El sistema SHALL compactar el historial únicamente al terminar un turno. El sistema
SHALL NOT compactar entre pasos del mismo turno. El sistema SHALL NOT compactar
mientras una respuesta del modelo se está produciendo.

#### Scenario: Compacta una sola vez por turno
- **WHEN** un turno termina y el historial quedó fuera del presupuesto
- **THEN** el sistema compacta una vez al final de ese turno

#### Scenario: No compacta en cada paso
- **WHEN** un turno lleva varios pasos
- **THEN** el sistema no compacta entre ellos

### Requirement: El presupuesto de un subagente es independiente del del padre
El turno hijo SHALL tener su propio presupuesto, calculado sobre la ventana de
contexto del modelo que usa. El sistema SHALL NOT contar el historial del hijo en el
presupuesto del padre. El sistema SHALL contar el resultado del hijo como el
resultado de una herramienta.

#### Scenario: El historial del hijo no consume el presupuesto del padre
- **WHEN** el hijo acumula un historial largo durante su investigación
- **THEN** el presupuesto del padre no cambia por ese historial

#### Scenario: El resultado del hijo se cuenta como un resultado de herramienta
- **WHEN** el hijo devuelve su respuesta
- **THEN** el presupuesto del padre la cuenta como un resultado de herramienta

### Requirement: En el umbral de aviso el sistema informa sin modificar el historial
Cuando el uso alcance el umbral de aviso, el sistema SHALL informar el porcentaje de
presupuesto alcanzado. El sistema SHALL NOT modificar el historial en esa etapa. El
sistema SHALL NOT repetir el aviso en cada paso del mismo turno.

#### Scenario: Se cruza el umbral de aviso
- **WHEN** el uso del presupuesto alcanza el umbral de aviso
- **THEN** el sistema informa el porcentaje alcanzado y el historial no cambia

#### Scenario: El aviso no se repite
- **WHEN** el turno sigue avanzando después de cruzar el umbral de aviso
- **THEN** el sistema no vuelve a emitir el mismo aviso en ese turno

### Requirement: En el umbral de poda el sistema elimina pasos que no aportaron
Cuando el recorte no alcance, el sistema SHALL eliminar pasos cuyas únicas llamadas
sean de solo lectura, cuyos resultados ya estén enmascarados o vacíos y que no hayan
producido texto del modelo. El sistema SHALL NOT eliminar mensajes del usuario ni el
paso en curso. El sistema SHALL NOT separar una llamada de herramienta de su
respuesta.

#### Scenario: Un paso de solo lecturas ya enmascaradas se poda
- **WHEN** un paso anterior solo leyó archivos y sus resultados ya están enmascarados
- **THEN** el sistema elimina ese paso completo

#### Scenario: Un paso con una edición no se poda
- **WHEN** un paso anterior modificó un archivo
- **THEN** el sistema lo conserva

#### Scenario: La poda respeta la atomicidad
- **WHEN** el sistema elimina un paso
- **THEN** elimina la llamada y su respuesta juntas

#### Scenario: El paso en curso no se poda
- **WHEN** el sistema aplica la poda mientras el turno sigue
- **THEN** conserva el paso en curso

### Requirement: Los umbrales son configurables y ordenados
El sistema SHALL aplicar los umbrales por defecto 70% para avisar, 80% para
enmascarar, 85% para podar, 90% para resumir y 99% para compactar, medidos sobre el
límite del presupuesto. El sistema SHALL permitir configurarlos. Una configuración
que no sea estrictamente creciente SHALL fallar el arranque con un mensaje que
nombre los umbrales. El sistema SHALL NOT modificar el límite duro del presupuesto.

#### Scenario: Los valores por defecto
- **WHEN** el sistema arranca sin configuración de umbrales
- **THEN** aplica 70, 80, 85, 90 y 99 por ciento sobre el límite del presupuesto

#### Scenario: Una configuración desordenada falla
- **WHEN** los umbrales configurados no son estrictamente crecientes
- **THEN** el arranque falla con un mensaje que nombra los umbrales

#### Scenario: El límite duro no cambia
- **WHEN** el sistema aplica cualquier etapa
- **THEN** sigue sin enviar una petición que supere el límite del presupuesto

### Requirement: La etapa aplicada es visible
El sistema SHALL exponer la etapa aplicada en cada pasada del pipeline y cuántos
tokens recuperó. La interfaz SHALL mostrarlo en el panel de contexto.

#### Scenario: El panel muestra la etapa aplicada
- **WHEN** el pipeline aplica una etapa
- **THEN** el panel de contexto muestra cuál fue

#### Scenario: El panel muestra lo recuperado
- **WHEN** una etapa libera espacio
- **THEN** el panel de contexto muestra cuántos tokens se recuperaron
