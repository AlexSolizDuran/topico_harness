# Spec Delta

## ADDED Requirements

### Requirement: El sistema inyecta recordatorios de sistema en eventos del turno
El sistema SHALL inyectar recordatorios deterministas como mensajes de sistema,
nunca del usuario. SHALL cubrir tres eventos: tras una edición, sugerir verificar;
tras N pasos sin escritura, reinyectar el objetivo original; y tras compactar,
informar el resumen. SHALL conservar el objetivo fuera del historial compactable y
SHALL NOT repetir un recordatorio en pasos consecutivos ni más de una vez por
turno. SHALL insertarlo sin romper la atomicidad llamada-respuesta.

#### Scenario: Tras editar código
- **WHEN** una herramienta de edición termina correctamente
- **THEN** el sistema inyecta un recordatorio de sistema que sugiere verificar el cambio

#### Scenario: Tras varios pasos sin escribir
- **WHEN** el turno alcanza la cantidad configurable de pasos sin una escritura
- **THEN** el sistema inyecta el objetivo original como recordatorio de sistema

#### Scenario: Tras compactar
- **WHEN** el historial fue compactado al final del turno anterior
- **THEN** el sistema informa que el historial fue resumido y que el objetivo original sigue vigente

#### Scenario: El recordatorio no es un pedido del usuario
- **WHEN** el sistema agrega un recordatorio
- **THEN** el mensaje se marca como de sistema y no como del usuario

#### Scenario: El objetivo original sobrevive a la compactación
- **WHEN** la compactación reemplaza el turno donde se pidió la tarea
- **THEN** el sistema conserva el objetivo original y puede reinyectarlo

#### Scenario: No se repite en pasos consecutivos
- **WHEN** el mismo recordatorio ya se inyectó en el paso anterior
- **THEN** el sistema no lo vuelve a inyectar en el paso siguiente

#### Scenario: La atomicidad se conserva
- **WHEN** el sistema inyecta un recordatorio
- **THEN** lo hace sin separar una llamada de herramienta de su resultado
