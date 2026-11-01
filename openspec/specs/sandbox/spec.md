# sandbox Specification

## Purpose
El sandbox es el límite del sistema operativo que impide que una ejecución
autorizada haga más de lo permitido. Esta capacidad aísla la herramienta de
ejecución, limita sus escrituras al proyecto y a un temporal, y hace visible
cuándo el aislamiento no está disponible.

## Requirements

### Requirement: La herramienta de ejecución corre dentro de un aislamiento del sistema operativo
En las plataformas que ofrecen aislamiento del sistema operativo, el sistema
SHALL ejecutar la herramienta de ejecución dentro de ese aislamiento. El
aislamiento SHALL limitar las escrituras al directorio del proyecto y a un
directorio temporal. El sistema SHALL NOT depender de analizar el comando para
decidir el aislamiento: la herramienta completa corre aislada.

#### Scenario: Ejecución aislada
- **WHEN** la plataforma ofrece aislamiento y está habilitado
- **THEN** la herramienta de ejecución corre dentro del aislamiento

#### Scenario: Escritura dentro del proyecto
- **WHEN** un comando aislado escribe dentro del directorio del proyecto
- **THEN** la escritura se permite

#### Scenario: Escritura fuera del proyecto
- **WHEN** un comando aislado intenta escribir fuera del proyecto y del temporal
- **THEN** el aislamiento impide la escritura

#### Scenario: Temporal disponible
- **WHEN** un comando aislado necesita escribir en un temporal
- **THEN** puede usar el temporal de la ejecución

### Requirement: El aislamiento se aplica por herramienta y no por comando
El sistema SHALL aplicar el aislamiento a la herramienta de ejecución completa,
sin clasificar comandos individuales. Las herramientas de lectura y edición SHALL
conservar sus propias reglas de rutas. El aislamiento SHALL NOT depender del
catálogo de comandos ni de la lista negra.

#### Scenario: Comando permitido
- **WHEN** un comando del catálogo corre con aislamiento habilitado
- **THEN** corre aislado igual que cualquier otro comando

#### Scenario: Comando fuera del catálogo
- **WHEN** un comando fuera del catálogo corre con aislamiento habilitado
- **THEN** también corre aislado

#### Scenario: Lectura conserva sus reglas
- **WHEN** una herramienta de lectura accede a una ruta
- **THEN** se aplican sus propias reglas y no el aislamiento de ejecución

### Requirement: Un intento de salir del aislamiento vuelve como error de texto
Si un comando intenta escribir fuera del proyecto y del temporal, el aislamiento
SHALL impedirlo. El sistema SHALL devolver el fallo al modelo como texto, SHALL
NOT tirar la excepción y SHALL NOT terminar el turno.

#### Scenario: El error vuelve al modelo
- **WHEN** un comando aislado intenta escribir fuera del proyecto
- **THEN** el modelo recibe el fallo como texto

#### Scenario: La lectura fuera se rige por la configuración
- **WHEN** un comando aislado intenta leer fuera del proyecto
- **THEN** el resultado depende de la configuración de lectura y no de una excepción

#### Scenario: El turno continúa
- **WHEN** un comando choca con el aislamiento
- **THEN** el turno sigue en curso

### Requirement: Sin aislamiento disponible el sistema no finge
En una plataforma sin aislamiento disponible, el sistema SHALL informar de forma
visible que la ejecución no está aislada. SHALL NOT presentar la ejecución como
aislada. La ejecución SHALL seguir las reglas de permisos y aprobación vigentes.

#### Scenario: Plataforma sin aislamiento
- **WHEN** la plataforma no ofrece un mecanismo de aislamiento
- **THEN** el sistema avisa que la ejecución no está aislada

#### Scenario: El aviso es visible
- **WHEN** se ejecuta sin aislamiento
- **THEN** la persona ve el aviso durante el turno

#### Scenario: No se presenta como aislada
- **WHEN** la ejecución no corrió aislada
- **THEN** el resultado y la interfaz no la presentan como aislada

### Requirement: La configuración puede habilitar o deshabilitar el aislamiento
La configuración SHALL permitir habilitar o deshabilitar el aislamiento. El valor
por defecto SHALL ser habilitado. Deshabilitarlo SHALL producir un aviso visible y
SHALL NOT presentar la ejecución como aislada.

#### Scenario: Valor por defecto
- **WHEN** la configuración no declara el aislamiento
- **THEN** el aislamiento se considera habilitado

#### Scenario: Aislamiento deshabilitado
- **WHEN** la configuración deshabilita el aislamiento
- **THEN** la ejecución corre sin aislamiento y con aviso

#### Scenario: El aviso no es un error fatal
- **WHEN** el aislamiento está deshabilitado
- **THEN** la sesión sigue funcionando y el aviso no la cancela

### Requirement: El aislamiento no rompe comandos que necesitan temporales
El aislamiento SHALL permitir escrituras en un directorio temporal propio de la
ejecución. El sistema SHALL limpiar ese directorio al terminar o cancelar la
ejecución. Un comando que necesita un temporal SHALL funcionar sin pedir permisos
extra.

#### Scenario: Comando que usa un temporal
- **WHEN** un comando aislado escribe en su temporal
- **THEN** la escritura se permite y el comando termina normalmente

#### Scenario: Limpieza del temporal
- **WHEN** la ejecución termina o se cancela
- **THEN** el sistema limpia el temporal de esa ejecución

#### Scenario: Sin permisos extra
- **WHEN** un comando usa el temporal de la ejecución
- **THEN** no se pide una aprobación adicional por esa escritura
