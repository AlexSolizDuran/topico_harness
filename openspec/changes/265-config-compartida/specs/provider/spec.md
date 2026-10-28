# Spec Delta

## MODIFIED Requirements

### Requirement: La credencial se lee del entorno y nunca se expone
El sistema SHALL obtener la credencial del entorno al iniciar una petición. El
sistema SHALL NOT incluir la credencial en ningún evento que produzca. El sistema
SHALL NOT escribir la credencial en ningún registro, ni en el texto devuelto al
modelo tras un fallo. Cuando la variable declarada no exista en el entorno, el
sistema SHALL nombrar la variable faltante y SHALL mencionar `.env` como el lugar
donde declararla.

#### Scenario: Un fallo de red no expone la credencial
- **WHEN** una petición falla por un error de conexión
- **THEN** el mensaje de error devuelto no contiene la credencial

#### Scenario: El registro de una petición no la contiene
- **WHEN** el sistema registra la petición que realizó
- **THEN** el registro no incluye la credencial ni los encabezados que la portan

#### Scenario: Falta la credencial
- **WHEN** el entorno no define la credencial del provider configurado
- **THEN** el sistema informa que falta antes de intentar la petición, en lugar de enviarla mal formada

#### Scenario: La falta indica dónde declararla
- **WHEN** la variable declarada en `variableApiKey` no existe en el entorno
- **THEN** el error nombra esa variable y menciona `.env`

## ADDED Requirements

### Requirement: El config del proyecto se versiona sin credencial literal
El sistema SHALL aceptar que `.harness/config.json` se versione y SHALL NOT aceptar
una credencial literal en él. Si el config del proyecto declara `apiKey`, el sistema
SHALL fallar el arranque con un mensaje que indique usar `variableApiKey` y `.env`.
El sistema SHALL seguir aceptando `apiKey` en el config global, que no se versiona.
El mensaje de error SHALL NOT incluir el valor de la credencial.

#### Scenario: Un config de proyecto sin credencial arranca
- **WHEN** `.harness/config.json` declara `variableApiKey` y no declara `apiKey`
- **THEN** el sistema arranca y resuelve la credencial desde el entorno

#### Scenario: La credencial vive en .env
- **WHEN** `.env` define la variable declarada en `variableApiKey`
- **THEN** el sistema la toma del entorno y no del config

#### Scenario: apiKey en el config del proyecto falla
- **WHEN** `.harness/config.json` declara `apiKey`
- **THEN** el arranque falla con un mensaje que indica usar `variableApiKey` y `.env`

#### Scenario: El error no imprime la credencial
- **WHEN** el config del proyecto declara `apiKey`
- **THEN** el mensaje de error no incluye su valor

#### Scenario: apiKey en el config global sigue funcionando
- **WHEN** el config global declara `apiKey` y el del proyecto no
- **THEN** el sistema resuelve la credencial desde el config global
