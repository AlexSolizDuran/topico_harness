# Tasks

## 1. Tokens desde el provider

- [x] 1.1 Capturar `fin.tokens` en `consultarProveedor` y propagarlo por `ejecutarUnPaso`; verificar con un provider simulado que reporta tokens.
- [x] 1.2 Agregar `tokens?: ConteoTokens` a `EstadoTurno` y devolverlo en los tres estados; verificar con tests de completado, cancelado y fallido.
- [x] 1.3 Verificar que sin tokens del provider se usa la estimación y `esEstimado` es `true`; test con provider simulado sin `usage`.

## 2. Presupuesto

- [x] 2.1 Construir `PresupuestoContexto` en `SesionInteractiva` con la ventana recibida por opciones; verificar que el límite es el 80%.
- [x] 2.2 Validar el presupuesto antes de enviar y, si se excede, no arrancar el turno y mostrar un aviso; verificar con un historial artificialmente grande.
- [x] 2.3 Recalcular el presupuesto cuando cambia la ventana de contexto; verificar que el límite se actualiza.

## 3. Recorte y compactación

- [x] 3.1 Ejecutar el recorte de salidas viejas al terminar el turno cuando se supera el umbral de cercanía; verificar que la última salida de herramienta queda intacta.
- [x] 3.2 Compactar una sola vez cuando el recorte no alcanza; verificar con un test que un turno de varios pasos no compacta entre pasos.
- [x] 3.3 Preservar el prompt del sistema y la atomicidad después de compactar; verificar con `validarHistorialAtomico` y un test del primer mensaje.
- [x] 3.4 Capturar un error de compactación sin romper el turno; verificar con un test que el historial queda sin compactar y el error vuelve como aviso.

## 4. Credenciales y cierre

- [x] 4.1 Pasar `credencialesSanitizar` desde `runner.ts` a `ejecutarTurno`; verificar que un error de herramienta con la clave en el texto sale redactado.
- [x] 4.2 Test «Compacta una sola vez por turno»: el historial resultante tiene exactamente un mensaje de resumen nuevo.
- [x] 4.3 Test «No compacta en cada paso»: con tres pasos y presupuesto excedido, solo hay un resumen al final.
- [x] 4.4 Test «El prompt del sistema nunca se descarta»: tras varias compactaciones el primer mensaje sigue siendo el system original.
- [x] 4.5 Correr `npm run check` y verificar lint, typecheck y tests en verde.
