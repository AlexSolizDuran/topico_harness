# Spec Delta

## MODIFIED Requirements

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

### Requirement: Cuando el recorte no alcanza el sistema resume el historial
Cuando el recorte por sí solo no mantenga el historial dentro del presupuesto, el
sistema SHALL reemplazar los turnos más antiguos por un resumen. El sistema SHALL
conservar los turnos más recientes sin resumir. El sistema SHALL resumir solo al
final de un turno, cuando el modelo ya terminó de producir. El sistema SHALL
repetir la compactación mientras el historial siga fuera del presupuesto y queden
turnos para resumir. El sistema SHALL NOT acumular más de un resumen automático:
al compactar de nuevo SHALL reemplazar el resumen anterior por uno nuevo.

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
