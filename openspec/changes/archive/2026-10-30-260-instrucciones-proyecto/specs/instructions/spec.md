# Spec Delta

## Purpose

Las instrucciones del proyecto son el contexto estable que el agente necesita en
cada sesión: convenciones, comandos de verificación y estructura. Esta capacidad
las carga al arrancar, las conserva durante la sesión y falla de forma visible
cuando no caben.

## ADDED Requirements

### Requirement: El harness carga las instrucciones del proyecto al arrancar
El sistema SHALL leer `AGENTS.md` de la raíz del proyecto una vez al construir la
sesión y SHALL inyectar su contenido en el prompt de sistema. Si el archivo no
existe, el sistema SHALL continuar sin error. Si el archivo no tiene contenido, el
sistema SHALL NOT modificar el prompt. El sistema SHALL NOT leer otros archivos
del proyecto como instrucciones.

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
