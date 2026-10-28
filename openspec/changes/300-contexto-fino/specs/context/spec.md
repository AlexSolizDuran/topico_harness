# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
